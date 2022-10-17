import asyncio
import logging
from pathlib import Path
from typing import List, Union, Optional

from multidict import MultiDictProxy
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import IndexMinimal, IndexSearchResult, Index, IndexFile
from virtool_core.models.reference import ReferenceNested

import virtool.indexes.db
from virtool.api.custom_json import dumps
from virtool.api.utils import compose_regex_query, paginate
from virtool.config import Config
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.history.db import LIST_PROJECTION
from virtool.indexes.db import (
    FILES,
    update_last_indexed_versions,
)
from virtool.indexes.models import SQLIndexFile, IndexType
from virtool.indexes.utils import join_index_path
from virtool.mongo.core import DB
from virtool.pg.utils import get_rows
from virtool.uploads.utils import naive_writer
from virtool.utils import run_in_thread, compress_json_with_gzip

logger = logging.getLogger("indexes")


class IndexData:
    def __init__(self, mongo: DB, config: Config, pg: AsyncEngine):
        self._config = config
        self._mongo = mongo
        self._pg = pg

    async def find(
        self, ready: bool, query: MultiDictProxy
    ) -> Union[List[IndexMinimal], IndexSearchResult]:
        """
        List all indexes.

        :param ready: the request object
        :param query: the request query object
        :return: a list of all index documents
        """
        if not ready:
            data = await virtool.indexes.db.find(self._mongo, query)
            return IndexSearchResult(**data)

        pipeline = [
            {"$match": {"ready": True}},
            {"$sort": {"version": -1}},
            {
                "$group": {
                    "_id": "$reference.id",
                    "index": {"$first": "$_id"},
                    "version": {"$first": "$version"},
                    "change_count": {"$first": "$change_count"},
                    "created_at": {"$first": "$created_at"},
                    "has_files": {"$first": "$has_files"},
                    "modified_otu_count": {"$first": "$modified_otu_count"},
                    "user": {"$first": "$user"},
                    "ready": {"$first": "$ready"},
                    "job": {"$first": "$job"},
                }
            },
        ]

        ready_indexes = []

        async for agg in self._mongo.indexes.aggregate(pipeline):
            user = await self._mongo.users.find_one(agg["user"]["id"])
            ready_indexes.append(
                {
                    "id": agg["index"],
                    "version": agg["version"],
                    "reference": {
                        "id": agg["_id"],
                    },
                    "change_count": agg["change_count"],
                    "created_at": agg["created_at"],
                    "has_files": agg["has_files"],
                    "modified_otu_count": agg["modified_otu_count"],
                    "user": {
                        "id": user["_id"],
                        "handle": user["handle"],
                        "administrator": user["administrator"],
                    },
                    "ready": agg["ready"],
                    "job": agg["job"],
                }
            )

        return [IndexMinimal(**index) for index in ready_indexes]

    async def get(self, index_id: str) -> Index:
        """
        Get a single index by its ID.

        :param index_id: the index ID
        :return: the index
        """
        document = await self._mongo.indexes.find_one(index_id)

        if not document:
            raise ResourceNotFoundError()

        contributors, otus = await asyncio.gather(
            virtool.history.db.get_contributors(self._mongo, {"index.id": index_id}),
            virtool.indexes.db.get_otus(self._mongo, index_id),
        )

        document.update(
            {
                "change_count": sum(v["change_count"] for v in otus),
                "contributors": contributors,
                "otus": otus,
            }
        )

        document = await virtool.indexes.db.attach_files(
            self._pg, self._config.base_url, document
        )

        document = await virtool.indexes.db.processor(self._mongo, document)

        return Index(**document)

    async def get_reference(self, index_id: str) -> ReferenceNested:
        """
        Get a reference associated with an index.

        :param index_id: the index ID
        :return: the reference
        """
        index = await self._mongo.indexes.find_one(index_id)

        if index:
            return ReferenceNested(**index["reference"])

        raise ResourceNotFoundError()

    async def get_json_path(self, index_id: str) -> Path:
        """
        Get the json path needed for a complete compressed JSON
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
                self._mongo, self._config, index["manifest"]
            )

            json_string = dumps(patched_otus)

            await run_in_thread(compress_json_with_gzip, json_string, json_path)

        return json_path

    async def upload_file(
        self, reference_id: str, index_id: str, file_type: str, name: str, multipart
    ) -> Optional[IndexFile]:
        """
        Uploads a new index file.

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

            path = (
                join_index_path(self._config.data_path, reference_id, index_id) / name
            )

            size = await naive_writer(await multipart(), path)

            index_file.size = size
            index_file.uploaded_at = virtool.utils.timestamp()
            index_file.ready = True

            index_file_dict = index_file.to_dict()

            await session.commit()

        return IndexFile(
            **index_file_dict, download_url=f"/indexes/{index_id}/files/{name}"
        )

    async def finalize(self, ref_id: str, index_id: str) -> Index:
        """
        Finalize an index document.

        :param ref_id: the reference ID
        :param index_id: the index ID
        :return: the finalized Index
        """
        reference = await self._mongo.references.find_one(ref_id)

        if reference is None:
            raise ResourceNotFoundError()

        rows = await get_rows(self._pg, SQLIndexFile, "index", index_id)

        results = {f.name: f.type for f in rows}

        if IndexType.fasta not in results.values():
            raise ResourceConflictError(
                "A FASTA file must be uploaded in order to finalize index"
            )

        if reference["data_type"] == "genome":
            required_files = [f for f in FILES if f != "reference.json.gz"]

            if missing_files := [f for f in required_files if f not in results]:
                raise ResourceConflictError(
                    f"Reference requires that all Bowtie2 index files have been uploaded. "
                    f"Missing files: {', '.join(missing_files)}"
                )

        async with self._mongo.create_session() as session:
            await update_last_indexed_versions(self._mongo, ref_id, session)

            await self._mongo.indexes.update_one(
                {"_id": index_id}, {"$set": {"ready": True}}, session=session
            )

        return await self.get(index_id)

    async def find_changes(
        self, index_id: str, req_query: MultiDictProxy[str]
    ) -> HistorySearchResult:
        """
        Find the virus changes that are included in a given index build.

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
            projection=LIST_PROJECTION,
            reverse=True,
        )

        return HistorySearchResult(**data)

    async def delete(self, index_id: str):
        """
        Delete an index given it's id.

        :param index_id: the ID of the index to delete
        """
        async with self._mongo.create_session() as session:
            delete_result = await self._mongo.indexes.delete_one(
                {"_id": index_id}, session=session
            )

            if delete_result.deleted_count == 0:
                raise ResourceNotFoundError()

            index_change_ids = await self._mongo.history.distinct(
                "_id", {"index.id": index_id}
            )

            await self._mongo.history.update_many(
                {"_id": {"$in": index_change_ids}},
                {"$set": {"index": {"id": "unbuilt", "version": "unbuilt"}}},
                session=session,
            )
