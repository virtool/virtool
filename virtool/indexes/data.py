import asyncio
from asyncio import to_thread
from logging import getLogger
from pathlib import Path
from typing import Dict, List, Optional, Union

from multidict import MultiDictProxy
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.history import HistorySearchResult
from virtool_core.models.index import Index, IndexFile, IndexMinimal, IndexSearchResult
from virtool_core.models.reference import ReferenceNested
from virtool_core.utils import file_stats

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
from virtool.data.events import emits, Operation, emit
from virtool.history.db import LIST_PROJECTION
from virtool.indexes.checks import check_fasta_file_uploaded, check_index_files_uploaded
from virtool.indexes.db import (
    INDEX_FILE_NAMES,
    lookup_index_otu_counts,
    update_last_indexed_versions,
)
from virtool.indexes.models import SQLIndexFile
from virtool.indexes.tasks import export_index, get_index_file_type_from_name
from virtool.indexes.utils import join_index_path
from virtool.jobs.db import lookup_minimal_job_by_id
from virtool.mongo.core import Mongo
from virtool.data.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import get_rows
from virtool.references.db import lookup_nested_reference_by_id
from virtool.references.transforms import AttachReferenceTransform
from virtool.uploads.utils import naive_writer
from virtool.users.db import AttachUserTransform, lookup_nested_user_by_id
from virtool.uploads.utils import naive_writer, file_chunks
from virtool.users.db import AttachUserTransform
from virtool.utils import compress_json_with_gzip, wait_for_checks

logger = getLogger("indexes")


class IndexData:
    name = "indexes"

    def __init__(self, mongo: Mongo, config: Config, pg: AsyncEngine):
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

        return [
            IndexMinimal(**index)
            async for index in self._mongo.indexes.aggregate(
                [
                    {
                        "$match": {
                            "ready": True,
                            "reference.id": {
                                "$in": await self._mongo.references.distinct("_id")
                            },
                        }
                    },
                    *lookup_minimal_job_by_id(),
                    *lookup_nested_reference_by_id(local_field="reference.id"),
                    *lookup_nested_user_by_id(),
                    *lookup_index_otu_counts(local_field="_id"),
                    {"$sort": {"created_at": 1}},
                    {"$project": {"counts": False}},
                ]
            )
        ]

    async def get(self, index_id: str) -> Index:
        """
        Get a single index by its ID.

        :param index_id: the index ID
        :return: the index
        """

        result = await self._mongo.indexes.aggregate(
            [
                {"$match": {"_id": index_id}},
                *lookup_minimal_job_by_id(),
                *lookup_nested_reference_by_id(local_field="reference.id"),
                *lookup_nested_user_by_id(),
                *lookup_index_otu_counts(local_field="_id"),
                {"$sort": {"created_at": 1}},
                {"$project": {"counts": False}},
            ]
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
            self._pg, self._config.base_url, document
        )

        return Index(**document)

    async def get_reference(self, index_id: str) -> ReferenceNested:
        """
        Get a reference associated with an index.

        :param index_id: the index ID
        :return: the reference
        """
        reference_field = await get_one_field(
            self._mongo.indexes, "reference", index_id
        )

        if reference_field and (
            reference := await self._mongo.references.find_one(
                {"_id": reference_field["id"]}, ["data_type", "name"]
            )
        ):
            return ReferenceNested(**reference)

        raise ResourceNotFoundError

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

            json_string = dump_bytes(patched_otus)

            await to_thread(compress_json_with_gzip, json_string, json_path)

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

            index_path = self._config.data_path / "references" / index_id
            await asyncio.to_thread(index_path.mkdir, parents=True, exist_ok=True)
            path = (
                join_index_path(self._config.data_path, reference_id, index_id) / name
            )

            size = await naive_writer(file_chunks(await multipart()), path)

            index_file.size = size
            index_file.uploaded_at = virtool.utils.timestamp()
            index_file.ready = True

            index_file_dict = index_file.to_dict()

            await session.commit()

        return IndexFile(
            **index_file_dict, download_url=f"/indexes/{index_id}/files/{name}"
        )

    @emits(Operation.UPDATE)
    async def finalize(self, index_id: str) -> Index:
        """
        Finalize an index document.

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

        data["documents"] = await apply_transforms(
            data["documents"],
            [AttachReferenceTransform(self._mongo), AttachUserTransform(self._mongo)],
        )

        return HistorySearchResult(**data)

    async def ensure_files(self):
        """
        Ensure all data files associated with indexes are tracked.

        If a JSON file does not exist for an index, create it. If creation fails, the
        error will be logged and the index will be skipped.

        """
        async for index in self._mongo.indexes.find({"ready": True}):
            index_id = index["_id"]

            index_path = join_index_path(
                self._config.data_path, index["reference"]["id"], index_id
            )

            try:
                await self._ensure_json(
                    index_path, index["reference"]["id"], index["manifest"]
                )
            except IndexError:
                logger.exception("Could not create JSON file for index id=%s", index_id)
                continue

            async with AsyncSession(self._pg) as session:
                first = (
                    await session.execute(
                        select(SQLIndexFile).where(SQLIndexFile.index == index_id)
                    )
                ).first()

                if first:
                    continue

                session.add_all(
                    [
                        SQLIndexFile(
                            name=path.name,
                            index=index_id,
                            type=get_index_file_type_from_name(path.name),
                            size=(await to_thread(file_stats, path))["size"],
                        )
                        for path in sorted(index_path.iterdir())
                        if path.name in INDEX_FILE_NAMES
                    ]
                )

                await session.commit()

    async def _ensure_json(self, path: Path, ref_id: str, manifest: Dict):
        """
        Ensure that a there is a compressed JSON representation of the index found at
        `path`` exists.

        :param path: the path to the index directory
        :param ref_id: the id of the parent reference
        :param manifest: the otu id-version manifest for the index
        """
        json_path = path / "reference.json.gz"

        if await to_thread(json_path.is_file):
            return

        reference = await self._mongo.references.find_one(
            ref_id, ["data_type", "organism", "targets"]
        )

        index_data = await export_index(self._config.data_path, self._mongo, manifest)

        await to_thread(
            compress_json_with_gzip,
            dump_bytes(
                {
                    "data_type": reference["data_type"],
                    "organism": reference["organism"],
                    "otus": index_data,
                    "targets": reference.get("targets"),
                }
            ),
            json_path,
        )

    async def delete(self, index_id: str):
        """
        Delete an index given it's id.

        :param index_id: the ID of the index to delete
        """
        index = await self.get(index_id)

        if not index:
            raise ResourceNotFoundError

        async with self._mongo.create_session() as mongo_session:
            delete_result = await self._mongo.indexes.delete_one(
                {"_id": index_id}, session=mongo_session
            )

            if delete_result.deleted_count == 0:
                raise ResourceNotFoundError

            index_change_ids = await self._mongo.history.distinct(
                "_id", {"index.id": index_id}
            )

            await self._mongo.history.update_many(
                {"_id": {"$in": index_change_ids}},
                {"$set": {"index": {"id": "unbuilt", "version": "unbuilt"}}},
                session=mongo_session,
            )

        emit(index, "indexes", "delete", Operation.DELETE)
