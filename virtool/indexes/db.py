"""Work with indexes in the database."""

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import pymongo
from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import (
    ARRAY,
    Integer,
    Text,
    cast,
    distinct,
    func,
    literal,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.pg.utils
import virtool.references.db
import virtool.utils
from virtool.api.utils import paginate
from virtool.data.topg import (
    both_transactions,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndexFile
from virtool.jobs.transforms import AttachJobTransform
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU
from virtool.references.db import (
    compose_reference_id_match,
    compose_reference_ids_match,
)
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

OTU_ID_CHUNK_SIZE = 500
"""The number of OTU ids bound into a single ``last_indexed_version`` update.

asyncpg binds one parameter per id, so an unbounded ``IN`` would blow its parameter
limit on a reference whose OTUs all sit in one version bucket. A freshly imported
reference is exactly that: every OTU is version 0.
"""

REFERENCE_JSON_V2_FILE_NAME = "reference-v2.json.gz"

JOB_INDEX_FILE_NAMES = (
    "reference.fa.gz",
    "reference.json.gz",
    "reference.1.bt2",
    "reference.2.bt2",
    "reference.3.bt2",
    "reference.4.bt2",
    "reference.rev.1.bt2",
    "reference.rev.2.bt2",
)

INDEX_FILE_NAMES = (*JOB_INDEX_FILE_NAMES, REFERENCE_JSON_V2_FILE_NAME)


class IndexCountsTransform(AbstractTransform):
    """Attaches modification counts to index documents from the legacy history table."""

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, **prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        change_count, modified_otu_count = (
            await session.execute(
                select(
                    func.count(),
                    func.count(distinct(SQLLegacyHistory.otu)),
                ).where(SQLLegacyHistory.index == document["id"]),
            )
        ).one()

        return {
            "change_count": change_count,
            "modified_otu_count": modified_otu_count,
        }

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> Any:
        index_ids = [document["id"] for document in documents]

        rows = (
            await session.execute(
                select(
                    SQLLegacyHistory.index,
                    func.count(),
                    func.count(distinct(SQLLegacyHistory.otu)),
                )
                .where(SQLLegacyHistory.index.in_(index_ids))
                .group_by(SQLLegacyHistory.index),
            )
        ).all()

        counts = {
            index: {
                "change_count": change_count,
                "modified_otu_count": modified_otu_count,
            }
            for index, change_count, modified_otu_count in rows
        }

        return {
            index_id: counts.get(
                index_id,
                {"change_count": 0, "modified_otu_count": 0},
            )
            for index_id in index_ids
        }


async def create(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: str,
    user_id: int,
    job_id: int,
    index_id: str | None = None,
) -> dict:
    """Create a new index and update history to show the version and id of the new
    index.

    :param mongo: the application database client
    :param pg: the application Postgres client
    :param ref_id: the ID of the reference to create index for
    :param user_id: the ID of the current user
    :param job_id: the ID of the job
    :param index_id: the ID of the index
    :return: the new index document
    """
    index_version, manifest = await asyncio.gather(
        get_next_version(mongo, pg, ref_id),
        virtool.references.db.get_manifest(mongo, pg, ref_id),
    )

    document = {
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": manifest,
        "ready": False,
        "has_files": True,
        "has_json": False,
        "job": {"id": job_id},
        "task": None,
        "user": {"id": user_id},
    }

    if index_id:
        document["_id"] = index_id

    async with both_transactions(mongo, pg) as (mongo_session, pg_session):
        reference_pk = await resolve_legacy_id(pg_session, SQLReference, ref_id)

        if reference_pk is None:
            raise ValueError(f"Reference {ref_id!r} not found in postgres")

        document["reference"] = {"id": reference_pk}

        document = await mongo.indexes.insert_one(document, session=mongo_session)

        await pg_session.execute(
            update(SQLLegacyHistory)
            .where(
                SQLLegacyHistory.reference_id
                == compose_legacy_id_subquery(SQLReference, ref_id),
                SQLLegacyHistory.index.is_(None),
            )
            .values(index=document["_id"], index_version=str(index_version)),
        )

    return document


async def find(
    mongo: "Mongo",
    pg: AsyncEngine,
    page: int,
    per_page: int,
    ref_id: str | None = None,
    archived: bool | None = None,
) -> dict:
    """Find index documents.

    When ``ref_id`` is given, ``archived`` is ignored — the reference is
    already chosen, so its lifecycle state is fixed.

    :param mongo: the application database client
    :param page: the one-indexed page number to return
    :param per_page: the number of documents to return per page
    :param ref_id: the id of the reference
    :param archived: lifecycle filter on the index's reference; see
        :func:`virtool.references.db.compose_reference_ids_match`
    :return: the index document

    """
    mongo_query: dict = {}

    if ref_id:
        base_query = {"reference.id": await compose_reference_id_match(pg, ref_id)}
    else:
        # base_query is the orphan filter only (visibility scope). The lifecycle
        # filter goes into mongo_query so total_count reflects all indexes whose
        # reference exists, while found_count narrows to the requested
        # lifecycle.
        base_query = {"reference.id": await compose_reference_ids_match(pg)}

        if archived is not None:
            mongo_query = {
                "reference.id": await compose_reference_ids_match(pg, archived),
            }

    data = await paginate(
        mongo.indexes,
        mongo_query,
        page,
        per_page,
        base_query=base_query,
        projection=[
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
        ],
        reverse=True,
        sort="version",
    )

    unbuilt_stats = await get_unbuilt_stats(mongo, pg, ref_id)

    documents = [base_processor(d) for d in data["documents"]]
    transforms = [
        AttachJobTransform(pg),
        AttachReferenceTransform(pg),
        AttachUserTransform(pg),
        IndexCountsTransform(),
    ]

    return {
        **data,
        **unbuilt_stats,
        "documents": await apply_transforms(
            documents,
            transforms,
            pg,
        ),
    }


async def get_current_id_and_version(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: str,
) -> tuple[str | None, int]:
    """Return the current index id and version number.

    :param mongo: the application database client
    :param pg: the application Postgres client
    :param ref_id: the id of the reference to get the current index for

    :return: the index and version of the current index

    """
    document = await mongo.indexes.find_one(
        {
            "reference.id": await compose_reference_id_match(pg, ref_id),
            "ready": True,
        },
        sort=[("version", pymongo.DESCENDING)],
        projection=["_id", "version"],
    )

    if document is None:
        return None, -1

    return document["_id"], document["version"]


async def get_otus(pg: AsyncEngine, index_id: str) -> list[dict]:
    """Return a list of otus and number of changes for a specific index.

    The OTU name is taken from the change with the highest ``otu_version``, mirroring
    the Mongo aggregation's ``$first`` after sorting by version descending. OTUs whose
    latest change has no name are excluded.

    :param pg: the application PostgreSQL database object
    :param index_id: the id of the index to get otus for

    :return: a list of otus modified in the index

    """
    async with AsyncSession(pg) as session:
        rows = (
            await session.execute(
                select(
                    SQLLegacyHistory.otu,
                    SQLLegacyHistory.otu_name,
                    func.count()
                    .over(partition_by=SQLLegacyHistory.otu)
                    .label("change_count"),
                )
                .where(SQLLegacyHistory.index == index_id)
                .distinct(SQLLegacyHistory.otu)
                .order_by(
                    SQLLegacyHistory.otu,
                    cast(SQLLegacyHistory.otu_version, Integer).desc().nulls_last(),
                ),
            )
        ).all()

    return sorted(
        (
            {"id": row.otu, "name": row.otu_name, "change_count": row.change_count}
            for row in rows
            if row.otu_name is not None
        ),
        key=lambda otu: otu["name"],
    )


async def get_next_version(mongo: "Mongo", pg: AsyncEngine, ref_id: str) -> int:
    """Get the version number that should be used for the next index build.

    :param mongo: the application mongodb client
    :param pg: the application Postgres client
    :param ref_id: the id of the reference to get the next version for

    :return: the next version number

    """
    return await mongo.indexes.count_documents(
        {
            "reference.id": await compose_reference_id_match(pg, ref_id),
            "ready": True,
        },
    )


async def get_unbuilt_stats(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: str | None = None,
) -> dict:
    """Get the number of unbuilt changes and number of OTUs affected by those changes.

    Used to populate the metadata for an index find request. Can search against a
    specific reference or all references.

    :param mongo: the application mongodb client
    :param pg: the application PostgreSQL database object
    :param ref_id: the ref id to search unbuilt changes for

    :return: the change count and modified OTU count

    """
    ref_query = {}
    history_filters = [SQLLegacyHistory.index.is_(None)]

    if ref_id:
        ref_query["reference.id"] = await compose_reference_id_match(pg, ref_id)
        history_filters.append(
            SQLLegacyHistory.reference_id
            == compose_legacy_id_subquery(SQLReference, ref_id),
        )

    async with AsyncSession(pg) as session:
        change_count, modified_otu_count = (
            await session.execute(
                select(
                    func.count(),
                    func.count(distinct(SQLLegacyHistory.otu)),
                ).where(*history_filters),
            )
        ).one()

    return {
        "total_otu_count": await mongo.otus.count_documents(ref_query),
        "change_count": change_count,
        "modified_otu_count": modified_otu_count,
    }


async def iter_patched_otus(
    mongo: "Mongo",
    pg: AsyncEngine,
    manifest: dict[str, int],
    *,
    concurrency: int = 25,
    window_size: int = 100,
) -> AsyncIterator[dict]:
    """Iterate joined OTUs patched to the versions in the manifest.

    :param mongo: the application mongodb client
    :param pg: the application PostgreSQL database object
    :param manifest: the manifest
    :param concurrency: the maximum number of OTUs to patch concurrently
    :param window_size: the maximum number of scheduled OTUs ahead of the next yield

    """
    items = list(enumerate(manifest.items()))
    next_to_schedule = 0
    next_to_yield = 0
    pending: set[asyncio.Task[tuple[int, dict]]] = set()
    completed: dict[int, dict] = {}

    async def patch_otu(
        position: int,
        patch_id: str,
        patch_version: int,
    ) -> tuple[int, dict]:
        _, patched = await virtool.history.db.patch_to_version(
            mongo,
            pg,
            patch_id,
            patch_version,
        )

        return position, patched

    try:
        while next_to_yield < len(items):
            while (
                next_to_schedule < len(items)
                and len(pending) < concurrency
                and next_to_schedule - next_to_yield < window_size
            ):
                position, (patch_id, patch_version) = items[next_to_schedule]
                pending.add(
                    asyncio.create_task(patch_otu(position, patch_id, patch_version)),
                )
                next_to_schedule += 1

            if next_to_yield in completed:
                patched = completed.pop(next_to_yield)
                next_to_yield += 1
                yield patched
                continue

            done, _ = await asyncio.wait(
                pending,
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in done:
                pending.remove(task)
                position, patched = await task
                completed[position] = patched

    except (Exception, asyncio.CancelledError, GeneratorExit):
        for task in pending:
            task.cancel()

        await asyncio.gather(*pending, return_exceptions=True)
        raise


async def upsert_index_file(
    session: AsyncSession,
    index_id: str,
    file_type: str,
    name: str,
    size: int,
) -> dict[str, Any]:
    """Create or update an index file row."""
    index_file_id = (
        await session.execute(
            pg_insert(SQLIndexFile)
            .values(
                index=index_id,
                name=name,
                size=size,
                type=file_type,
            )
            .on_conflict_do_update(
                index_elements=[SQLIndexFile.index, SQLIndexFile.name],
                set_={"size": size, "type": file_type},
            )
            .returning(SQLIndexFile.id),
        )
    ).scalar_one()

    return {
        "id": index_file_id,
        "index": index_id,
        "name": name,
        "size": size,
        "type": file_type,
    }


async def update_last_indexed_versions(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: str,
    mongo_session: AsyncIOMotorClientSession,
    pg_session: AsyncSession,
) -> None:
    """Update the `last_indexed_version` field for OTUs associated with `ref_id`

    Both stores are stamped from the same ``{version: [otu_id]}`` grouping, so the
    same OTUs are stamped with the same version in each. ``last_indexed_version`` has
    no promoted column on ``legacy_otus``; it lives in the ``data`` JSONB, so only
    that key is rewritten. OTUs with no Postgres row yet are simply not matched --
    the backfill will carry the stamped Mongo document over.

    :param mongo: the application mongo client
    :param pg: the application Postgres client
    :param ref_id: the id of the reference whose otus should be updated
    :param mongo_session: the motor session to use
    :param pg_session: the Postgres session to use

    """
    pipeline = [
        {
            "$project": {
                "reference": True,
                "version": True,
                "last_indexed_version": True,
                "comp": {"$cmp": ["$version", "$last_indexed_version"]},
            },
        },
        {
            "$match": {
                "reference.id": await compose_reference_id_match(pg, ref_id),
                "comp": {"$ne": 0},
            },
        },
        {"$group": {"_id": "$version", "id_list": {"$addToSet": "$_id"}}},
    ]

    id_version_key = {
        agg["_id"]: agg["id_list"] async for agg in mongo.otus.aggregate(pipeline)
    }

    for version, id_list in id_version_key.items():
        await mongo.otus.update_many(
            {"_id": {"$in": id_list}},
            {"$set": {"last_indexed_version": version}},
            session=mongo_session,
        )

    for version, id_list in id_version_key.items():
        for start in range(0, len(id_list), OTU_ID_CHUNK_SIZE):
            await pg_session.execute(
                update(SQLOTU)
                .where(SQLOTU.id.in_(id_list[start : start + OTU_ID_CHUNK_SIZE]))
                .values(
                    data=func.jsonb_set(
                        SQLOTU.data,
                        literal(["last_indexed_version"], ARRAY(Text)),
                        func.to_jsonb(cast(version, Integer)),
                    ),
                ),
            )


async def attach_files(pg: AsyncEngine, base_url: str, document: dict) -> dict:
    """Attach a list of index files under `files` field.

    :param pg: the application Postgres client
    :param base_url: the application base URL
    :param document: an index document

    :return: Index document with updated `files` entry containing a list of index files.

    """
    index_id = document["_id"]

    rows = await virtool.pg.utils.get_rows(pg, SQLIndexFile, "index", index_id)

    files = []

    for index_file in [row.to_dict() for row in rows]:
        location = f"/indexes/{index_id}/files/{index_file['name']}"

        files.append(
            {
                **index_file,
                "download_url": str(base_url) + location,
            },
        )

    return {**document, "files": files}
