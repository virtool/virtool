import asyncio
import gzip
from collections.abc import AsyncIterator

from multidict import MultiDictProxy
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.history.db
import virtool.indexes.db
from virtool.api.custom_json import dump_bytes
from virtool.api.utils import compose_regex_query, paginate
from virtool.config import Config
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.transforms import apply_transforms
from virtool.history.db import HISTORY_LIST_PROJECTION
from virtool.history.models import HistorySearchResult
from virtool.indexes.checks import (
    check_legacy_index_files_uploaded,
)
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    LEGACY_INDEX_FILE_NAMES,
    TASK_INDEX_FILE_NAMES,
    lookup_index_otu_counts,
    update_last_indexed_versions,
)
from virtool.indexes.models import Index, IndexFile, IndexMinimal, IndexSearchResult
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.transforms import attach_index_build, attach_index_builds
from virtool.indexes.utils import (
    compose_index_file_key,
    compose_index_prefix,
    iter_compressed_reference_ndjson,
)
from virtool.jobs.transforms import AttachJobTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_rows
from virtool.references.db import compose_archived_filter, lookup_nested_reference_by_id
from virtool.references.models import ReferenceNested
from virtool.references.transforms import AttachReferenceTransform
from virtool.storage.cleanup import delete_prefix
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import StorageBackend
from virtool.tasks.transforms import AttachTaskTransform
from virtool.uploads.utils import multipart_file_chunker
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, wait_for_checks

logger = get_logger("indexes")


def _get_index_build_type(document: dict) -> str:
    job_id = document["job"]["id"] if document.get("job") is not None else None
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


def _get_index_file_names_for_build_type(document: dict) -> tuple[str, ...]:
    match _get_index_build_type(document):
        case "job":
            return LEGACY_INDEX_FILE_NAMES
        case "task":
            return TASK_INDEX_FILE_NAMES


def _check_index_file_matches_build_type(document: dict, name: str) -> None:
    if name in _get_index_file_names_for_build_type(document):
        return

    build_type = _get_index_build_type(document)

    raise ResourceConflictError(
        f"{name} cannot be uploaded for {build_type}-backed index builds"
    )


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
        query: MultiDictProxy,
        archived: bool | None = None,
    ) -> list[IndexMinimal] | IndexSearchResult:
        """List all indexes.

        :param ready: the request object
        :param query: the request query object
        :param archived: lifecycle filter on the index's reference; see
            :func:`virtool.references.db.compose_archived_filter`
        :return: a list of all index documents
        """
        if not ready:
            data = await virtool.indexes.db.find(
                self._mongo, self._pg, query, archived=archived
            )
            return IndexSearchResult(**data)

        items = [
            base_processor(index)
            async for index in self._mongo.indexes.aggregate(
                [
                    {
                        "$match": {
                            "ready": True,
                            "reference.id": {
                                "$in": await self._mongo.references.distinct(
                                    "_id",
                                    compose_archived_filter(archived),
                                ),
                            },
                        },
                    },
                    *lookup_nested_reference_by_id(local_field="reference.id"),
                    *lookup_index_otu_counts(local_field="_id"),
                    {"$sort": {"created_at": 1}},
                    {"$project": {"counts": False}},
                ],
            )
        ]

        items = attach_index_builds(
            await apply_transforms(
                items,
                [
                    AttachJobTransform(self._pg),
                    AttachTaskTransform(self._pg),
                    AttachUserTransform(self._pg),
                ],
                self._pg,
            ),
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
                *lookup_nested_reference_by_id(local_field="reference.id"),
                *lookup_index_otu_counts(local_field="_id"),
                {"$sort": {"created_at": 1}},
                {"$project": {"counts": False}},
            ],
        ).to_list(length=1)

        if not result:
            raise ResourceNotFoundError()

        document = result[0]

        contributors, otus = await asyncio.gather(
            virtool.history.db.get_contributors(
                self._mongo, self._pg, {"index.id": index_id}
            ),
            virtool.indexes.db.get_otus(self._mongo, index_id),
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
                AttachTaskTransform(self._pg),
                AttachUserTransform(self._pg),
            ],
            self._pg,
        )

        return Index(**attach_index_build(document))

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
                {"_id": reference_field["id"]},
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

            async def _stream():
                yield compressed

            size = await self._storage.write(key, _stream())

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
        index = await self._mongo.indexes.find_one(
            {"_id": index_id},
            ["job", "task"],
        )

        if index is None:
            raise ResourceNotFoundError()

        _check_index_file_matches_build_type(index, name)

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
            index_file.uploaded_at = virtool.utils.timestamp()
            index_file.ready = True

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

        data_type = await get_one_field(self._mongo.references, "data_type", ref_id)

        if data_type is None:
            raise ResourceNotFoundError

        results = {
            f.name: f.type
            for f in await get_rows(self._pg, SQLIndexFile, "index", index_id)
        }

        await wait_for_checks(
            check_legacy_index_files_uploaded(results, data_type),
        )

        async with self._mongo.create_session() as session:
            await update_last_indexed_versions(self._mongo, ref_id, session)

            await self._mongo.indexes.update_one(
                {"_id": index_id},
                {"$set": {"ready": True}},
                session=session,
            )

        return await self.get(index_id)

    @emits(Operation.UPDATE)
    async def generate_reference_file(self, index_id: str) -> Index:
        """Generate the task-backed reference file and mark the index ready."""
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

        reference = await self._mongo.references.find_one(
            {"_id": ref_id},
            ["data_type", "name"],
        )

        if reference is None:
            raise ResourceNotFoundError()

        reference = ReferenceNested(**reference).dict()
        file_name = TASK_INDEX_FILE_NAMES[0]

        patched_otus = virtool.indexes.db.iter_patched_otus(
            self._mongo,
            self._pg,
            index["manifest"],
        )

        size = await self._storage.write(
            compose_index_file_key(index_id, file_name),
            iter_compressed_reference_ndjson(reference, patched_otus),
        )

        await virtool.indexes.db.upsert_index_file(
            self._pg,
            index_id,
            "ndjson",
            file_name,
            size,
        )

        async with self._mongo.create_session() as session:
            await update_last_indexed_versions(self._mongo, ref_id, session)

            await self._mongo.indexes.update_one(
                {"_id": index_id},
                {"$set": {"ready": True}},
                session=session,
            )

        return await self.get(index_id)

    async def find_changes(
        self,
        index_id: str,
        req_query: MultiDictProxy[str],
    ) -> HistorySearchResult:
        """Find the virus changes that are included in a given index build.
        :param index_id: the index ID
        :param req_query: the request query object
        :return: the changes
        """
        if not await self._mongo.indexes.count_documents({"_id": index_id}):
            raise ResourceNotFoundError()

        db_query = {"index.id": index_id}

        if term := req_query.get("term"):
            db_query.update(compose_regex_query(term, ["otu.name", "user.id"]))

        data = await paginate(
            self._mongo.history,
            db_query,
            req_query,
            sort=[("otu.name", 1), ("otu.version", -1)],
            projection=HISTORY_LIST_PROJECTION,
            reverse=True,
        )

        data["documents"] = await apply_transforms(
            [base_processor(d) for d in data["documents"]],
            [AttachReferenceTransform(self._mongo), AttachUserTransform(self._pg)],
            self._pg,
        )

        return HistorySearchResult(**data)

    async def delete(self, index_id: str) -> None:
        """Delete an index given it's id.

        :param index_id: the ID of the index to delete
        """
        index = await self.get(index_id)

        if not index:
            raise ResourceNotFoundError

        async with self._mongo.create_session() as mongo_session:
            delete_result = await self._mongo.indexes.delete_one(
                {"_id": index_id},
                session=mongo_session,
            )

            if delete_result.deleted_count == 0:
                raise ResourceNotFoundError

            index_change_ids = await self._mongo.history.distinct(
                "_id",
                {"index.id": index_id},
            )

            await self._mongo.history.update_many(
                {"_id": {"$in": index_change_ids}},
                {"$set": {"index": {"id": "unbuilt", "version": "unbuilt"}}},
                session=mongo_session,
            )

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
