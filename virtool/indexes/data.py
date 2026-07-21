import asyncio
import gzip
from collections.abc import AsyncIterator

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.history.db
import virtool.indexes.db
from virtool.api.custom_json import dump_bytes
from virtool.config import Config
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
)
from virtool.data.transforms import apply_transforms
from virtool.history.models import HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.checks import (
    check_fasta_file_uploaded,
    check_index_files_uploaded,
)
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    REFERENCE_JSON_V2_FILE_NAME,
    IndexCountsTransform,
    _row_to_document,
    update_last_indexed_versions,
)
from virtool.indexes.models import Index, IndexFile, IndexMinimal, IndexSearchResult
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
)
from virtool.jobs.transforms import AttachJobTransform
from virtool.references.models import ReferenceNested
from virtool.references.sql import SQLReference
from virtool.references.transforms import (
    AttachReferenceTransform,
    shape_nested_reference,
)
from virtool.storage.cleanup import delete_prefix
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.utils import multipart_file_chunker
from virtool.users.transforms import AttachUserTransform
from virtool.utils import wait_for_checks

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

    async def _resolve_storage_key(self, index_id: int) -> str:
        """Return the object-storage key slug for an index.

        Migrated indexes store their files under the legacy Mongo id; indexes
        created natively in Postgres store under a minted UUID. Both live in the
        load-bearing ``storage_key`` column, which cannot be derived from the
        public index id. Raises ResourceNotFoundError if no index matches.
        """
        async with AsyncSession(self._pg) as session:
            storage_key = (
                await session.execute(
                    select(SQLIndex.storage_key).where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                    ),
                )
            ).scalar_one_or_none()

        if storage_key is None:
            raise ResourceNotFoundError

        return storage_key

    async def find(
        self,
        ready: bool,
        page: int,
        per_page: int,
        archived: bool | None = None,
    ) -> list[IndexMinimal] | IndexSearchResult:
        """List all indexes.

        :param ready: return only indexes that are ready for use in analysis
        :param page: the one-indexed page number to return
        :param per_page: the number of documents to return per page
        :param archived: lifecycle filter on the index's reference
        :return: a list of all index documents
        """
        if not ready:
            data = await virtool.indexes.db.find(
                self._pg, page, per_page, archived=archived
            )
            return IndexSearchResult(**data)

        filters = [SQLIndex.ready.is_(True)]

        if archived is not None:
            filters.append(
                SQLIndex.reference_id.in_(
                    select(SQLReference.id).where(SQLReference.archived == archived),
                ),
            )

        async with AsyncSession(self._pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLIndex).where(*filters).order_by(SQLIndex.created_at),
                    )
                )
                .scalars()
                .all()
            )

        items = [_row_to_document(row) for row in rows]

        items = await apply_transforms(
            items,
            [
                AttachJobTransform(self._pg),
                AttachReferenceTransform(self._pg),
                AttachUserTransform(self._pg),
                IndexCountsTransform(),
            ],
            self._pg,
        )

        return [IndexMinimal(**item) for item in items]

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
            self._config.base_url,
            document,
        )

        document = await apply_transforms(
            document,
            [
                AttachJobTransform(self._pg),
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
                    select(SQLIndex.manifest, SQLIndex.storage_key).where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError()

        manifest = row.manifest

        key = compose_index_file_key(row.storage_key, "otus.json.gz")

        try:
            size = await self._storage.size(key)
        except StorageKeyNotFoundError:
            patched_otus = [
                otu
                async for otu in virtool.indexes.db.iter_patched_otus(
                    self._pg,
                    manifest,
                )
            ]

            compressed = await asyncio.to_thread(
                gzip.compress, dump_bytes(patched_otus)
            )

            async def stream():
                yield compressed

            size = await self._storage.write(key, stream())

        return self._storage.read(key), size

    async def upload_file(
        self,
        index_id: int,
        file_type: str,
        name: str,
        multipart,
    ) -> IndexFile:
        """Uploads a new index file.

        :param index_id: the index ID
        :param file_type: the type of the file to upload
        :param name: the name of the new file
        :param multipart: the file reader
        :return: the index file
        """
        async with AsyncSession(self._pg) as session:
            index_row = (
                await session.execute(
                    select(SQLIndex.id, SQLIndex.storage_key).where(
                        compose_legacy_id_single_expression(SQLIndex, index_id),
                    ),
                )
            ).one_or_none()

            if index_row is None:
                raise ResourceNotFoundError

            index_file = SQLIndexFile(
                name=name,
                index=str(index_id),
                index_id=index_row.id,
                type=file_type,
            )

            session.add(index_file)

            try:
                await session.flush()
            except IntegrityError:
                raise ResourceConflictError()

            key = compose_index_file_key(index_row.storage_key, name)

            size = await self._storage.write(
                key,
                multipart_file_chunker(await multipart()),
            )

            index_file.size = size

            index_file_dict = index_file.to_dict()

            await session.commit()

        return IndexFile(
            **{**index_file_dict, "index": index_id},
            download_url=f"/indexes/{index_id}/files/{name}",
        )

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
                    select(SQLIndexFile).where(
                        SQLIndexFile.index_id
                        == compose_legacy_id_subquery(SQLIndex, index_id),
                        SQLIndexFile.name == filename,
                    ),
                )
            ).scalar()

        if row is None:
            raise ResourceNotFoundError

        storage_key = await self._resolve_storage_key(index_id)

        key = compose_index_file_key(storage_key, filename)

        return self._storage.read(key), row.size

    @emits(Operation.UPDATE)
    async def finalize(self, index_id: int) -> Index:
        """Finalize an index document.

        :param index_id: the index ID
        :return: the finalized Index
        """
        async with AsyncSession(self._pg) as session:
            reference_id = await session.scalar(
                select(SQLIndex.reference_id).where(
                    compose_legacy_id_single_expression(SQLIndex, index_id),
                ),
            )

        if reference_id is None:
            raise ResourceError("Could not find index reference id")

        async with AsyncSession(self._pg) as session:
            file_rows = (
                (
                    await session.execute(
                        select(SQLIndexFile).where(
                            SQLIndexFile.index_id
                            == compose_legacy_id_subquery(SQLIndex, index_id),
                        ),
                    )
                )
                .scalars()
                .all()
            )

        results = {f.name: f.type for f in file_rows}

        await wait_for_checks(
            check_fasta_file_uploaded(results),
            check_index_files_uploaded(results),
        )

        async with AsyncSession(self._pg) as session:
            await update_last_indexed_versions(reference_id, session)

            await session.execute(
                update(SQLIndex)
                .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                .values(ready=True),
            )

            await session.commit()

        return await self.get(index_id)

    @emits(Operation.UPDATE)
    async def generate_task_index(self, index_id: int | str) -> Index:
        """Generate the task-backed index JSON artifact and mark the index ready.

        ``index_id`` accepts both the integer public id and the stringified form: a
        task created before the integer-id cutover carries the string in its context,
        so both must resolve for one release. ``compose_legacy_id_single_expression``
        routes either form to the integer primary key.
        """
        async with AsyncSession(self._pg) as session:
            index_row = (
                await session.execute(
                    select(
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

        file_name = REFERENCE_JSON_V2_FILE_NAME
        patched_otus = [
            otu
            async for otu in virtool.indexes.db.iter_patched_otus(
                self._pg,
                index_row.manifest,
            )
        ]
        compressed = await asyncio.to_thread(
            gzip.compress,
            dump_bytes({**reference, "otus": patched_otus}),
        )

        storage_key = await self._resolve_storage_key(index_id)

        key = compose_index_file_key(storage_key, file_name)

        async def stream():
            yield compressed

        try:
            # Storage cannot participate in the database transactions. A hard process
            # exit can leave an unready object, but a retried build overwrites it.
            size = await self._storage.write(
                key,
                stream(),
            )

            async with AsyncSession(self._pg) as session:
                await virtool.indexes.db.upsert_index_file(
                    session,
                    index_id,
                    "json",
                    file_name,
                    size,
                )

                await update_last_indexed_versions(reference_id, session)

                await session.execute(
                    update(SQLIndex)
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                    .values(ready=True),
                )

                await session.commit()
        except BaseException:
            await self._storage.delete(key)

            async with AsyncSession(self._pg) as session:
                row = (
                    await session.execute(
                        select(SQLIndexFile).where(
                            SQLIndexFile.index_id
                            == compose_legacy_id_subquery(SQLIndex, index_id),
                            SQLIndexFile.name == file_name,
                        ),
                    )
                ).scalar_one_or_none()

                if row is not None:
                    await session.delete(row)
                    await session.commit()

            raise

        return await self.get(index_id)

    async def find_changes(
        self,
        index_id: int,
        page: int,
        per_page: int,
        term: str | None = None,
    ) -> HistorySearchResult:
        """Find the virus changes that are included in a given index build.

        :param index_id: the index ID
        :param page: the one-indexed page number to return
        :param per_page: the number of documents to return per page
        :param term: an optional term matched against the OTU name
        :return: the changes
        """
        async with AsyncSession(self._pg) as session:
            exists = await session.scalar(
                select(
                    select(SQLIndex.id)
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                    .exists(),
                ),
            )

        if not exists:
            raise ResourceNotFoundError()

        data = await virtool.history.db.find_by_index(
            self._pg,
            index_id,
            page,
            per_page,
            term,
        )

        return HistorySearchResult(**data)

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

        storage_key = await self._resolve_storage_key(index_id)

        async with AsyncSession(self._pg) as session:
            # Re-check readiness inside the transaction under a row lock. The guard
            # above races a concurrent ``finalize``: it can read ``ready=False``
            # moments before finalize commits ``ready=True``. Locking the index row
            # serializes this delete against finalize's ready update, so it observes
            # the committed ready state instead of erasing a freshly built index.
            row = (
                await session.execute(
                    select(SQLIndex.id, SQLIndex.ready)
                    .where(compose_legacy_id_single_expression(SQLIndex, index_id))
                    .with_for_update(),
                )
            ).one_or_none()

            if row is None:
                raise ResourceNotFoundError

            if row.ready:
                raise ResourceConflictError("Ready indexes cannot be deleted")

            await session.execute(
                update(SQLLegacyHistory)
                .where(SQLLegacyHistory.index_id == row.id)
                .values(index=None, index_id=None),
            )

            await session.execute(
                delete(SQLIndex).where(SQLIndex.id == row.id),
            )

            await session.commit()

        for key, exc in await delete_prefix(
            self._storage, compose_index_prefix(storage_key)
        ):
            logger.error(
                "storage cleanup failed; file orphaned",
                index_id=index_id,
                key=key,
                error=repr(exc),
            )

        emit(index, "indexes", "delete", Operation.DELETE)
