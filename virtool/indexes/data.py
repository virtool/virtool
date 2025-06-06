import asyncio
from asyncio import to_thread
from pathlib import Path

from multidict import MultiDictProxy
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
from virtool.indexes.checks import check_fasta_file_uploaded, check_index_files_uploaded
from virtool.indexes.db import (
    lookup_index_otu_counts,
    update_last_indexed_versions,
)
from virtool.indexes.models import Index, IndexFile, IndexMinimal, IndexSearchResult
from virtool.indexes.sql import SQLIndexFile
from virtool.indexes.utils import join_index_path
from virtool.jobs.transforms import AttachJobTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_rows
from virtool.references.db import lookup_nested_reference_by_id
from virtool.references.models import ReferenceNested
from virtool.references.transforms import AttachReferenceTransform
from virtool.uploads.utils import multipart_file_chunker, naive_writer
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, compress_json_with_gzip, wait_for_checks

logger = get_logger("indexes")


class IndexData:
    name = "indexes"

    def __init__(self, mongo: Mongo, config: Config, pg: AsyncEngine):
        self._config = config
        self._mongo = mongo
        self._pg = pg

    async def find(
        self,
        ready: bool,
        query: MultiDictProxy,
    ) -> list[IndexMinimal] | IndexSearchResult:
        """List all indexes.

        :param ready: the request object
        :param query: the request query object
        :return: a list of all index documents
        """
        if not ready:
            data = await virtool.indexes.db.find(self._mongo, query)
            return IndexSearchResult(**data)

        items = [
            base_processor(index)
            async for index in self._mongo.indexes.aggregate(
                [
                    {
                        "$match": {
                            "ready": True,
                            "reference.id": {
                                "$in": await self._mongo.references.distinct("_id"),
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

        items = await apply_transforms(
            items,
            [AttachJobTransform(self._mongo), AttachUserTransform(self._mongo)],
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
            virtool.history.db.get_contributors(self._mongo, {"index.id": index_id}),
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
                AttachJobTransform(self._mongo),
                AttachUserTransform(self._mongo),
            ],
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
                {"_id": reference_field["id"]},
                ["data_type", "name"],
            )
        ):
            return ReferenceNested(**reference)

        raise ResourceNotFoundError

    async def get_json_path(self, index_id: str) -> Path:
        """Get the json path needed for a complete compressed JSON
        representation of the index OTUs.

        :param index_id: the index ID
        :return: the json path
        """
        index = await self._mongo.indexes.find_one(index_id)

        if index is None:
            raise ResourceNotFoundError()

        ref_id = index["reference"]["id"]

        json_path = (
            join_index_path(self._config.data_path, ref_id, index_id) / "otus.json.gz"
        )

        if not json_path.exists():
            patched_otus = await virtool.indexes.db.get_patched_otus(
                self._mongo,
                self._config,
                index["manifest"],
            )

            json_string = dump_bytes(patched_otus)

            await to_thread(compress_json_with_gzip, json_string, json_path)

        return json_path

    async def upload_file(
        self,
        reference_id: str,
        index_id: str,
        file_type: str,
        name: str,
        multipart,
    ) -> IndexFile:
        """Uploads a new index file.

        :param reference_id: the reference ID
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

            index_path = self._config.data_path / "references" / index_id

            await asyncio.to_thread(index_path.mkdir, parents=True, exist_ok=True)

            path = (
                join_index_path(self._config.data_path, reference_id, index_id) / name
            )

            size = await naive_writer(multipart_file_chunker(await multipart()), path)

            index_file.size = size
            index_file.uploaded_at = virtool.utils.timestamp()
            index_file.ready = True

            index_file_dict = index_file.to_dict()

            await session.commit()

        return IndexFile(
            **index_file_dict,
            download_url=f"/indexes/{index_id}/files/{name}",
        )

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

        aws = [check_fasta_file_uploaded(results)]

        if data_type == "genome":
            aws.append(check_index_files_uploaded(results))

        await wait_for_checks(*aws)

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
            [AttachReferenceTransform(self._mongo), AttachUserTransform(self._mongo)],
        )

        return HistorySearchResult(**data)

    async def delete(self, index_id: str):
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

        emit(index, "indexes", "delete", Operation.DELETE)
