import asyncio
import gzip
from collections.abc import AsyncIterator
from contextlib import aclosing
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.history.db
import virtool.indexes.db
from virtool.api.custom_json import dump_bytes
from virtool.config import Config
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
)
from virtool.data.transforms import apply_transforms
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    IndexCountsTransform,
    _row_to_document,
    update_last_indexed_versions,
)
from virtool.indexes.models import Index
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.references.models import ReferenceNested
from virtool.references.sql import SQLReference
from virtool.references.sqlite import (
    REFERENCE_SQLITE_FILE_NAME,
    REFERENCE_SQLITE_GZIP_FILE_NAME,
    SQLiteReference,
)
from virtool.references.transforms import (
    AttachReferenceTransform,
    shape_nested_reference,
)
from virtool.storage.cleanup import delete_keys
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.file import read_file_chunks
from virtool.storage.keys import mint_storage_key
from virtool.storage.protocol import StorageBackend
from virtool.users.transforms import AttachUserTransform
from virtool.utils import compress_file_with_gzip

logger = get_logger("indexes")


def _get_index_build_type(job_id: int | None, task_id: int | None) -> str:
    if job_id is None and task_id is None:
        raise ResourceConflictError(
            "Index must be backed by exactly one job or task build"
        )

    if job_id is not None and task_id is not None:
        raise ResourceConflictError(
            "Index must be backed by exactly one job or task build"
        )

    return "job" if job_id is not None else "task"


class IndexData:
    name = "indexes"

    def __init__(self, config: Config, pg: AsyncEngine, storage: StorageBackend):
        self._config = config
        self._pg = pg
        self._storage = storage

    async def get(self, index_id: int) -> Index:
        """Get a single index by its ID.

        :param index_id: the index ID
        :return: the index
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLIndex).where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                    ),
                )
            ).scalar_one_or_none()

        if row is None:
            raise ResourceNotFoundError()

        document = _row_to_document(row, include_manifest=True)

        contributors, otus = await asyncio.gather(
            virtool.history.db.get_contributors(self._pg, index_id=index_id),
            virtool.indexes.db.get_otus(self._pg, index_id),
        )

        document.update({"contributors": contributors, "otus": otus})

        document = await virtool.indexes.db.attach_files(
            self._pg,
            document,
        )

        document = await apply_transforms(
            document,
            [
                AttachReferenceTransform(self._pg),
                AttachUserTransform(self._pg),
                IndexCountsTransform(),
            ],
            self._pg,
        )

        return Index(**document)

    async def get_reference(self, index_id: int) -> ReferenceNested:
        """Get a reference associated with an index.

        :param index_id: the index ID
        :return: the reference
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLReference.id, SQLReference.name)
                    .join(SQLIndex, SQLIndex.reference_id == SQLReference.id)
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id)),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError

        return ReferenceNested(**shape_nested_reference(row.id, row.name))

    async def get_otus_json(
        self,
        index_id: int,
    ) -> tuple[AsyncIterator[bytes], int]:
        """Get a complete compressed JSON representation of the index OTUs.

        :param index_id: the index ID
        :return: an async iterator of bytes and the size
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(
                        SQLIndex.id,
                        SQLIndex.manifest,
                        SQLIndex.otus_json_storage_key,
                    ).where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError()

        manifest = row.manifest
        key = row.otus_json_storage_key

        if key is not None:
            try:
                return self._storage.read(key), await self._storage.size(key)
            except StorageKeyNotFoundError:
                pass
        else:
            key = mint_storage_key("indexes", row.id)

        patched_otus = [
            otu
            async for otu in virtool.indexes.db.iter_patched_otus(
                self._pg,
                manifest,
            )
        ]

        compressed = await asyncio.to_thread(gzip.compress, dump_bytes(patched_otus))

        async def stream():
            yield compressed

        size = await self._storage.write(key, stream())

        # Recorded only after the write succeeds, so a failed materialization
        # never leaves the index pointing at an object that does not exist.
        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLIndex)
                .where(SQLIndex.id == row.id)
                .values(otus_json_storage_key=key),
            )
            await session.commit()

        return self._storage.read(key), size

    async def get_index_file(
        self,
        index_id: int,
        filename: str,
    ) -> tuple[AsyncIterator[bytes], int]:
        """Get an index file as a stream.

        :param index_id: the index ID
        :param filename: the file name
        :return: an async iterator of bytes and the size
        """
        if filename not in INDEX_FILE_NAMES:
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLIndexFile.size, SQLIndexFile.storage_key)
                    .join(SQLIndex, SQLIndexFile.index_id == SQLIndex.id)
                    .where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                        SQLIndexFile.name == filename,
                    ),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError

        return self._storage.read(row.storage_key), row.size

    @emits(Operation.UPDATE)
    async def generate_task_index(self, index_id: int | str) -> Index:
        """Generate task-backed reference artifacts and mark the index ready.

        ``index_id`` accepts both the integer public id and the stringified form: a
        task created before the integer-id cutover carries the string in its context,
        so both must resolve for one release. ``compose_legacy_id_single_expression``
        routes either form to the integer primary key.

        :param index_id: the task-backed index to generate
        """
        async with AsyncSession(self._pg) as session:
            index_row = (
                await session.execute(
                    select(
                        SQLIndex.id,
                        SQLIndex.manifest,
                        SQLIndex.reference_id,
                        SQLIndex.job_id,
                        SQLIndex.task_id,
                        SQLIndex.ready,
                    ).where(compose_legacy_id_single_expression(SQLIndex, index_id)),
                )
            ).one_or_none()

        if index_row is None:
            raise ResourceNotFoundError()

        if _get_index_build_type(index_row.job_id, index_row.task_id) != "task":
            raise ResourceConflictError("Index must be backed by a task build")

        if index_row.ready:
            message = "Index is already ready"
            raise ResourceConflictError(message)

        reference_id = index_row.reference_id

        async with AsyncSession(self._pg) as session:
            reference_row = (
                await session.execute(
                    select(SQLReference).where(SQLReference.id == reference_id),
                )
            ).scalar_one_or_none()

        if reference_row is None:
            raise ResourceNotFoundError()

        reference = {
            "_id": reference_row.id,
            "created_at": reference_row.created_at,
            "data_type": "genome",
            "name": reference_row.name,
            "organism": reference_row.organism,
        }

        storage_key = mint_storage_key("indexes", index_row.id)

        try:
            with TemporaryDirectory() as temp_dir:
                sqlite_path = Path(temp_dir) / REFERENCE_SQLITE_FILE_NAME
                gzip_path = Path(temp_dir) / REFERENCE_SQLITE_GZIP_FILE_NAME

                async with aclosing(
                    virtool.indexes.db.iter_patched_otus(
                        self._pg,
                        index_row.manifest,
                    ),
                ) as patched_otus:
                    sqlite_reference = await SQLiteReference.create(
                        sqlite_path,
                        reference,
                        patched_otus,
                    )

                await sqlite_reference.validate()
                await asyncio.to_thread(
                    compress_file_with_gzip,
                    sqlite_path,
                    gzip_path,
                )

                # Storage cannot participate in the database transactions. A hard
                # process exit can leave an object no row names, which the orphan sweep
                # collects.
                gzip_size = await self._storage.write(
                    storage_key,
                    read_file_chunks(gzip_path),
                )

            async with AsyncSession(self._pg) as session:
                index_file = await virtool.indexes.db.upsert_index_file(
                    session,
                    index_id,
                    "sqlite",
                    REFERENCE_SQLITE_GZIP_FILE_NAME,
                    gzip_size,
                    storage_key,
                )

                await update_last_indexed_versions(reference_id, session)

                await session.execute(
                    update(SQLIndex)
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                    .values(ready=True),
                )

                await session.commit()
        except BaseException:
            for orphan_key, exc in await delete_keys(self._storage, [storage_key]):
                logger.error(
                    "storage cleanup failed; file orphaned",
                    index_id=index_id,
                    key=orphan_key,
                    error=repr(exc),
                )

            async with AsyncSession(self._pg) as session:
                await session.execute(
                    delete(SQLIndexFile).where(
                        SQLIndexFile.index_id
                        == compose_legacy_id_subquery(SQLIndex, index_id),
                        SQLIndexFile.name == REFERENCE_SQLITE_GZIP_FILE_NAME,
                        SQLIndexFile.storage_key == storage_key,
                    ),
                )
                await session.commit()

            raise

        # The new row is committed, so the superseded object is already an orphan.
        # Cleaning it up must not fail a build that otherwise succeeded.
        replaced_storage_key = index_file["replaced_storage_key"]

        if replaced_storage_key is not None:
            for orphan_key, exc in await delete_keys(
                self._storage,
                [replaced_storage_key],
            ):
                logger.error(
                    "storage cleanup failed; file orphaned",
                    index_id=index_id,
                    key=orphan_key,
                    error=repr(exc),
                )

        return await self.get(index_id)

    async def delete(self, index_id: int) -> None:
        """Delete an index given it's id.

        Only non-ready indexes (failed or in-progress builds) can be deleted. A
        ready index backs analyses and remains the reference's current build, so
        deleting one is rejected with a conflict.

        :param index_id: the ID of the index to delete
        :raises ResourceNotFoundError: if no index has the given id
        :raises ResourceConflictError: if the index is ready
        """
        index = await self.get(index_id)

        if not index:
            raise ResourceNotFoundError

        if index.ready:
            raise ResourceConflictError("Ready indexes cannot be deleted")

        async with AsyncSession(self._pg) as session:
            # Re-check readiness inside the transaction under a row lock. The guard
            # above races a concurrent ``finalize``: it can read ``ready=False``
            # moments before finalize commits ``ready=True``. Locking the index row
            # serializes this delete against finalize's ready update, so it observes
            # the committed ready state instead of erasing a freshly built index.
            row = (
                await session.execute(
                    select(
                        SQLIndex.id,
                        SQLIndex.ready,
                        SQLIndex.otus_json_storage_key,
                    )
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                    .with_for_update(),
                )
            ).one_or_none()

            if row is None:
                raise ResourceNotFoundError

            if row.ready:
                raise ResourceConflictError("Ready indexes cannot be deleted")

            # Read before the delete: index_files cascades on indexes.id.
            storage_keys = list(
                (
                    await session.execute(
                        select(SQLIndexFile.storage_key).where(
                            SQLIndexFile.index_id == row.id,
                        ),
                    )
                ).scalars(),
            )

            if row.otus_json_storage_key is not None:
                storage_keys.append(row.otus_json_storage_key)

            await session.execute(
                update(SQLLegacyHistory)
                .where(SQLLegacyHistory.index_id == row.id)
                .values(index=None, index_id=None),
            )

            await session.execute(
                delete(SQLIndex).where(SQLIndex.id == row.id),
            )

            await session.commit()

        for key, exc in await delete_keys(self._storage, storage_keys):
            logger.error(
                "storage cleanup failed; file orphaned",
                index_id=index_id,
                key=key,
                error=repr(exc),
            )

        emit(index, "indexes", "delete", Operation.DELETE)
