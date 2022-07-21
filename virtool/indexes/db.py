"""
Work with indexes in the database.

"""
import asyncio
import asyncio.tasks
from typing import Any, Dict, List, Optional, Tuple

import pymongo
from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.history.db
import virtool.pg.utils
import virtool.references.db
import virtool.utils
from virtool.api.utils import paginate
from virtool.config.cls import Config
from virtool.mongo.transforms import AbstractTransform, apply_transforms
from virtool.mongo.utils import get_new_id
from virtool.indexes.models import IndexFile
from virtool.types import Document
from virtool.users.db import AttachUserTransform

PROJECTION = [
    "_id",
    "created_at",
    "has_files",
    "job",
    "otu_count",
    "modification_count",
    "modified_count",
    "user",
    "ready",
    "reference",
    "version",
]

FILES = (
    "reference.fa.gz",
    "reference.json.gz",
    "reference.1.bt2",
    "reference.2.bt2",
    "reference.3.bt2",
    "reference.4.bt2",
    "reference.rev.1.bt2",
    "reference.rev.2.bt2",
)


class IndexCountsTransform(AbstractTransform):
    """
    Attaches modification counts to index documents based on OTU collection queries.
    """

    def __init__(self, db):
        self._db = db

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, **prepared}

    async def prepare_one(self, document: Document) -> Any:
        query = {"index.id": document["id"]}

        change_count, otu_ids = await asyncio.gather(
            self._db.history.count_documents(query),
            self._db.history.distinct("otu.id", query),
        )

        return {"change_count": change_count, "modified_otu_count": len(otu_ids)}


async def create(
    db, ref_id: str, user_id: str, job_id: str, index_id: Optional[str] = None
) -> dict:
    """
    Create a new index and update history to show the version and id of the new index.

    :param db: the application database client
    :param ref_id: the ID of the reference to create index for
    :param user_id: the ID of the current user
    :param job_id: the ID of the job
    :param index_id: the ID of the index
    :return: the new index document
    """
    index_id = index_id or await get_new_id(db.indexes)

    index_version = await get_next_version(db, ref_id)

    manifest = await virtool.references.db.get_manifest(db, ref_id)

    document = {
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": manifest,
        "ready": False,
        "has_files": True,
        "has_json": False,
        "reference": {"id": ref_id},
        "job": {"id": job_id},
        "user": {"id": user_id},
    }

    await db.indexes.insert_one(document)

    await db.history.update_many(
        {"index.id": "unbuilt", "reference.id": ref_id},
        {"$set": {"index": {"id": index_id, "version": index_version}}},
    )

    return document


async def processor(db, document: dict) -> dict:
    """
    A processor for index documents. Adds computed data about the index.

    :param db: the application database client
    :param document: the document to be processed
    :return: the processed document

    """
    return await apply_transforms(
        virtool.utils.base_processor(document),
        [AttachUserTransform(db), IndexCountsTransform(db)],
    )


async def find(db, req_query: dict, ref_id: Optional[str] = None) -> dict:
    """
    Find an index document matching the `req_query`

    :param db: the application database client
    :param req_query: the request object
    :param ref_id: the id of the reference
    :return: the index document

    """
    base_query = None

    if ref_id:
        base_query = {"reference.id": ref_id}

    data = await paginate(
        db.indexes,
        {},
        req_query,
        base_query=base_query,
        projection=PROJECTION,
        reverse=True,
        sort="version",
    )

    unbuilt_stats = await get_unbuilt_stats(db, ref_id)

    return {
        **data,
        **unbuilt_stats,
        "documents": await apply_transforms(
            data["documents"], [AttachUserTransform(db), IndexCountsTransform(db)]
        ),
    }


async def finalize(
    db, pg: AsyncEngine, base_url: str, ref_id: str, index_id: str
) -> dict:
    """
    Finalize an index document by setting `ready` to `True`.

    :param db: the application database client
    :param pg: the PostgreSQL AsyncEngine object
    :param base_url: the application base URL configuration value
    :param ref_id: the ID of the reference
    :param index_id: the ID of the index to be finalized for
    :return: the index document after finalization

    """
    await update_last_indexed_versions(db, ref_id)

    document = await db.indexes.find_one_and_update(
        {"_id": index_id}, {"$set": {"ready": True}}
    )

    return await attach_files(pg, base_url, document)


async def get_contributors(db, index_id: str) -> List[dict]:
    """
    Return an list of contributors and their contribution count for a specific index.

    :param db: the application database client
    :param index_id: the id of the index to get contributors for

    :return: a list of contributors to the index

    """
    return await virtool.history.db.get_contributors(db, {"index.id": index_id})


async def get_current_id_and_version(db, ref_id: str) -> Tuple[Optional[str], int]:
    """
    Return the current index id and version number.

    :param db: the application database client
    :param ref_id: the id of the reference to get the current index for

    :return: the index and version of the current index

    """
    document = await db.indexes.find_one(
        {"reference.id": ref_id, "ready": True},
        sort=[("version", pymongo.DESCENDING)],
        projection=["_id", "version"],
    )

    if document is None:
        return None, -1

    return document["_id"], document["version"]


async def get_otus(db, index_id: str) -> List[dict]:
    """
    Return a list of otus and number of changes for a specific index.

    :param db: the application database client
    :param index_id: the id of the index to get otus for

    :return: a list of otus modified in the index

    """
    cursor = db.history.aggregate(
        [
            {"$match": {"index.id": index_id}},
            {"$sort": {"otu.id": 1, "otu.version": -1}},
            {
                "$group": {
                    "_id": "$otu.id",
                    "name": {"$first": "$otu.name"},
                    "count": {"$sum": 1},
                }
            },
            {"$match": {"name": {"$ne": None}}},
            {"$sort": {"name": 1}},
        ]
    )

    return [
        {"id": v["_id"], "name": v["name"], "change_count": v["count"]}
        async for v in cursor
    ]


async def get_next_version(db, ref_id: str) -> int:
    """
    Get the version number that should be used for the next index build.

    :param db: the application database client
    :param ref_id: the id of the reference to get the next version for

    :return: the next version number

    """
    return await db.indexes.count_documents({"reference.id": ref_id, "ready": True})


async def get_unbuilt_stats(db, ref_id: Optional[str] = None) -> dict:
    """
    Get the number of unbuilt changes and number of OTUs affected by those changes.

    Used to populate the metadata for an index find request.Can search against a
    specific reference or all references.

    :param db: the application database client
    :param ref_id: the ref id to search unbuilt changes for

    :return: the change count and modified OTU count

    """
    ref_query = {}

    if ref_id:
        ref_query["reference.id"] = ref_id

    history_query = {**ref_query, "index.id": "unbuilt"}

    return {
        "total_otu_count": await db.otus.count_documents(ref_query),
        "change_count": await db.history.count_documents(history_query),
        "modified_otu_count": len(await db.history.distinct("otu.id", history_query)),
    }


async def reset_history(db, index_id: str):
    """
    Set the index.id and index.version fields with the given index id to 'unbuilt'.

    :param db: The virtool database
    :param index_id: The ID of the index which failed to build

    """
    query = {"_id": {"$in": await db.history.distinct("_id", {"index.id": index_id})}}

    return await db.history.update_many(
        query, {"$set": {"index": {"id": "unbuilt", "version": "unbuilt"}}}
    )


async def get_patched_otus(db, config: Config, manifest: Dict[str, int]) -> List[dict]:
    """
    Get joined OTUs patched to a specific version based on a manifest of OTU ids and
    versions.

    :param db: the job database client
    :param config: the application configuration
    :param manifest: the manifest

    """
    app_dict = {"db": db, "config": config}

    return [
        j[1]
        for j in await asyncio.tasks.gather(
            *[
                virtool.history.db.patch_to_version(app_dict, patch_id, patch_version)
                for patch_id, patch_version in manifest.items()
            ]
        )
    ]


async def update_last_indexed_versions(db, ref_id: str):
    """
    Update the `last_indexed_version` field for OTUs associated with `ref_id`

    :param db: Application database client
    :param ref_id: An ID that corresponds to an entry in the `references` db

    """
    # Find OTUs with changes.
    pipeline = [
        {
            "$project": {
                "reference": True,
                "version": True,
                "last_indexed_version": True,
                "comp": {"$cmp": ["$version", "$last_indexed_version"]},
            }
        },
        {"$match": {"reference.id": ref_id, "comp": {"$ne": 0}}},
        {"$group": {"_id": "$version", "id_list": {"$addToSet": "$_id"}}},
    ]

    id_version_key = {
        agg["_id"]: agg["id_list"] async for agg in db.otus.aggregate(pipeline)
    }

    # For each version number
    for version, id_list in id_version_key.items():
        await db.otus.update_many(
            {"_id": {"$in": id_list}}, {"$set": {"last_indexed_version": version}}
        )


async def attach_files(pg: AsyncEngine, base_url: str, document: dict) -> dict:
    """
    Attach a list of index files under `files` field.

    :param pg: the application Postgres client
    :param base_url: the application base URL
    :param document: an index document

    :return: Index document with updated `files` entry containing a list of index files.

    """
    index_id = document["_id"]

    rows = await virtool.pg.utils.get_rows(pg, IndexFile, "index", index_id)

    files = []

    for index_file in [row.to_dict() for row in rows]:
        location = f"/indexes/{index_id}/files/{index_file['name']}"

        files.append(
            {
                **index_file,
                "download_url": str(base_url) + location,
            }
        )

    return {**document, "files": files}
