import asyncio
import gzip
from collections.abc import AsyncIterator

from sqlalchemy import select, update
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
from virtool.data.topg import both_transactions, retry_both_transactions
from virtool.data.transforms import apply_transforms
from virtool.history.models import HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.checks import (
    check_fasta_file_uploaded,
    check_legacy_index_files_uploaded,
)
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    IndexCountsTransform,
    update_last_indexed_versions,
)
from virtool.indexes.models import Index, IndexFile, IndexMinimal, IndexSearchResult
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
)
from virtool.jobs.transforms import AttachJobTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_rows
from virtool.references.db import (
    compose_reference_ids_match,
    resolve_reference_legacy_id,
)
from virtool.references.models import ReferenceNested
from virtool.references.transforms import AttachReferenceTransform
from virtool.storage.cleanup import delete_prefix
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.uploads.utils import multipart_file_chunker
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, wait_for_checks

logger = get_logger("indexes")


def _get_index_build_type(document: dict) -> str:
    job_id = document["job"]["id"] if document["job"] is not None else None
    task_id = document["task"]["id"] if document["task"] is not None else None

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

    def __init__(
        self, mongo: Mongo, config: Config, pg: AsyncEngine, storage: StorageBackend
    ):
        self._config = config
        self._mongo = mongo
        self._pg = pg
        self._storage = storage

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
        :param archived: lifecycle filter on the index's reference; see
            :func:`virtool.references.db.compose_reference_ids_match`
        :return: a list of all index documents
        """
        if not ready:
            data = await virtool.indexes.db.find(
                self._mongo, self._pg, page, per_page, archived=archived
            )
            return IndexSearchResult(**data)

        items = [
            base_processor(index)
            async for index in self._mongo.indexes.aggregate(
                [
                    {
                        "$match": {
                            "ready": True,
                            "reference.id": await compose_reference_ids_match(
                                self._pg,
                                archived,
                            ),
                        },
                    },
                    {"$sort": {"created_at": 1}},
                ],
            )
        ]

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

    async def get(self, index_id: str) -> Index:
        """Get a single index by its ID.

        :param index_id: the index ID
        :return: the index
        """
        result = await self._mongo.indexes.aggregate(
            [
                {"$match": {"_id": index_id}},
                {"$sort": {"created_at": 1}},
            ],
        ).to_list(length=1)

        if not result:
            raise ResourceNotFoundError()

        document = result[0]

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
            base_processor(document),
            [
                AttachJobTransform(self._pg),
                AttachReferenceTransform(self._pg),
                AttachUserTransform(self._pg),
                IndexCountsTransform(),
            ],
            self._pg,
        )

        return Index(**document)

    async def get_reference(self, index_id: str) -> ReferenceNested:
        """Get a reference associated with an index.

        :param index_id: the index ID
        :return: the reference
        """
        reference_field = await get_one_field(
            self._mongo.indexes,
            "reference",
            index_id,
        )

        if reference_field and (
            reference := await self._mongo.references.find_one(
                {
                    "_id": await resolve_reference_legacy_id(
                        self._pg,
                        reference_field["id"],
                    ),
                },
                ["data_type", "name"],
            )
        ):
            return ReferenceNested(**reference)

        raise ResourceNotFoundError

    async def get_otus_json(
        self,
        index_id: str,
    ) -> tuple[AsyncIterator[bytes], int]:
        """Get a complete compressed JSON representation of the index OTUs.

        :param index_id: the index ID
        :return: an async iterator of bytes and the size
        """
        index = await self._mongo.indexes.find_one(index_id)

        if index is None:
            raise ResourceNotFoundError()

        key = compose_index_file_key(index_id, "otus.json.gz")

        try:
            size = await self._storage.size(key)
        except StorageKeyNotFoundError:
            patched_otus = [
                otu
                async for otu in virtool.indexes.db.iter_patched_otus(
                    self._mongo,
                    self._pg,
                    index["manifest"],
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
        index_id: str,
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
            index_file = SQLIndexFile(name=name, index=index_id, type=file_type)

            session.add(index_file)

            try:
                await session.flush()
            except IntegrityError:
                raise ResourceConflictError()

            key = compose_index_file_key(index_id, name)

            size = await self._storage.write(
                key,
                multipart_file_chunker(await multipart()),
            )

            index_file.size = size

            index_file_dict = index_file.to_dict()

            await session.commit()

        return IndexFile(
            **index_file_dict,
            download_url=f"/indexes/{index_id}/files/{name}",
        )

    async def get_index_file(
        self,
        index_id: str,
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
                    select(SQLIndexFile).filter_by(index=index_id, name=filename),
                )
            ).scalar()

        if row is None:
            raise ResourceNotFoundError

        key = compose_index_file_key(index_id, filename)

        return self._storage.read(key), row.size

    @emits(Operation.UPDATE)
    async def finalize(self, index_id: str) -> Index:
        """Finalize an index document.

        :param index_id: the index ID
        :return: the finalized Index
        """
        try:
            ref_id = (await get_one_field(self._mongo.indexes, "reference", index_id))[
                "id"
            ]
        except KeyError:
            raise ResourceError("Could not find index reference id")

        data_type = await get_one_field(
            self._mongo.references,
            "data_type",
            await resolve_reference_legacy_id(self._pg, ref_id),
        )

        if data_type is None:
            raise ResourceNotFoundError

        results = {
            f.name: f.type
            for f in await get_rows(self._pg, SQLIndexFile, "index", index_id)
        }

        checks = [check_fasta_file_uploaded(results)]

        if data_type == "genome":
            checks.append(check_legacy_index_files_uploaded(results))

        await wait_for_checks(*checks)

        async with self._mongo.create_session() as session:
            await update_last_indexed_versions(self._mongo, self._pg, ref_id, session)

            await self._mongo.indexes.update_one(
                {"_id": index_id},
                {"$set": {"ready": True}},
                session=session,
            )

        return await self.get(index_id)

    @emits(Operation.UPDATE)
    async def generate_task_index(self, index_id: str) -> Index:
        """Generate the task-backed index JSON artifact and mark the index ready."""
        index = await self._mongo.indexes.find_one(
            {"_id": index_id},
            ["manifest", "reference", "job", "task"],
        )

        if index is None:
            raise ResourceNotFoundError()

        if _get_index_build_type(index) != "task":
            raise ResourceConflictError("Index must be backed by a task build")

        try:
            ref_id = index["reference"]["id"]
        except KeyError:
            raise ResourceError("Could not find index reference id")

        legacy_ref_id = await resolve_reference_legacy_id(self._pg, ref_id)

        reference = await self._mongo.references.find_one(
            {"_id": legacy_ref_id},
            ["created_at", "data_type", "name", "organism"],
        )

        if reference is None:
            raise ResourceNotFoundError()

        file_name = "reference.json.gz"
        patched_otus = [
            otu
            async for otu in virtool.indexes.db.iter_patched_otus(
                self._mongo,
                self._pg,
                index["manifest"],
            )
        ]
        compressed = await asyncio.to_thread(
            gzip.compress,
            dump_bytes({**reference, "otus": patched_otus}),
        )

        key = compose_index_file_key(index_id, file_name)

        async def stream():
            yield compressed

        try:
            # Storage cannot participate in the database transactions. A hard process
            # exit can leave an unready object, but a retried build overwrites it.
            size = await self._storage.write(
                key,
                stream(),
            )

            async with both_transactions(self._mongo, self._pg) as (
                mongo_session,
                pg_session,
            ):
                await virtool.indexes.db.upsert_index_file(
                    pg_session,
                    index_id,
                    "json",
                    file_name,
                    size,
                )

                await update_last_indexed_versions(
                    self._mongo,
                    self._pg,
                    ref_id,
                    mongo_session,
                )

                await self._mongo.indexes.update_one(
                    {"_id": index_id},
                    {"$set": {"ready": True}},
                    session=mongo_session,
                )
        except BaseException:
            await self._storage.delete(key)

            async with AsyncSession(self._pg) as session:
                row = (
                    await session.execute(
                        select(SQLIndexFile).filter_by(index=index_id, name=file_name),
                    )
                ).scalar_one_or_none()

                if row is not None:
                    await session.delete(row)
                    await session.commit()

            raise

        return await self.get(index_id)

    async def find_changes(
        self,
        index_id: str,
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
        if not await self._mongo.indexes.count_documents({"_id": index_id}):
            raise ResourceNotFoundError()

        data = await virtool.history.db.find_by_index(
            self._mongo,
            self._pg,
            index_id,
            page,
            per_page,
            term,
        )

        return HistorySearchResult(**data)

    async def delete(self, index_id: str) -> None:
        """Delete an index given it's id.

        :param index_id: the ID of the index to delete
        """
        index = await self.get(index_id)

        if not index:
            raise ResourceNotFoundError

        async def remove(mongo_session, pg_session) -> None:
            delete_result = await self._mongo.indexes.delete_one(
                {"_id": index_id},
                session=mongo_session,
            )

            if delete_result.deleted_count == 0:
                raise ResourceNotFoundError

            await pg_session.execute(
                update(SQLLegacyHistory)
                .where(SQLLegacyHistory.index == index_id)
                .values(index=None, index_version=None),
            )

        await retry_both_transactions(self._mongo, self._pg, remove)

        for key, exc in await delete_prefix(
            self._storage, compose_index_prefix(index_id)
        ):
            logger.error(
                "storage cleanup failed; file orphaned",
                index_id=index_id,
                key=key,
                error=repr(exc),
            )

        emit(index, "indexes", "delete", Operation.DELETE)
