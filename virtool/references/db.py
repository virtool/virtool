"""Work with references in the database"""

import asyncio
import datetime
from typing import TYPE_CHECKING

import pymongo
from aiohttp.web import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio.engine import AsyncEngine

import virtool.history.db
import virtool.mongo.utils
import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.data.topg import compose_legacy_id_multi_expression
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.history.db import bulk_delete_history, bulk_insert_history
from virtool.history.sql import SQLLegacyHistory
from virtool.models.enums import HistoryMethod
from virtool.models.roles import AdministratorRole
from virtool.mongo.utils import get_mongo_from_req
from virtool.references.alot import prepare_otu_insertion
from virtool.settings.models import Settings
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.api.client import UserClient
    from virtool.mongo.core import Mongo


async def processor(mongo: "Mongo", pg: AsyncEngine, document: Document) -> Document:
    """Process a reference document to a form that can be expressed in a list.

    Used ``attach_computed`` for complete representations of the reference.

    :param mongo: the application Mongo client
    :param pg: the application PostgreSQL engine
    :param document: the document to process
    :return: the processed document
    """
    document = base_processor(document)

    ref_id = document["id"]

    latest_build, otu_count, unbuilt_count = await asyncio.gather(
        get_latest_build(mongo, pg, ref_id),
        get_otu_count(mongo, ref_id),
        get_unbuilt_count(pg, ref_id),
    )

    document.update(
        {
            "latest_build": latest_build,
            "otu_count": otu_count,
            "unbuilt_change_count": unbuilt_count,
        },
    )

    document["id"] = ref_id

    return document


async def get_reference_groups(pg: AsyncEngine, document: Document) -> list[Document]:
    """Get a detailed list of groups that have access to the specified reference.

    :param pg: the application Postgres engine
    :param document: the reference document
    :return: a list of group data dictionaries

    """
    if not document["groups"]:
        return []

    document_groups: list[Document] = document["groups"]

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLGroup).where(
                compose_legacy_id_multi_expression(
                    SQLGroup,
                    [g["id"] for g in document_groups],
                ),
            ),
        )

    rows = result.scalars().all()

    groups_map: dict[int | str, SQLGroup] = {
        **{row.id: row for row in rows},
        **{row.legacy_id: row for row in rows},
    }

    return [
        {
            **g,
            "id": groups_map[g["id"]].id,
            "legacy_id": groups_map[g["id"]].legacy_id,
            "name": groups_map[g["id"]].name,
        }
        for g in document_groups
    ]


async def get_reference_users(
    mongo: "Mongo", pg: AsyncEngine, document: Document
) -> list[Document]:
    """Get a detailed list of users that have access to the specified reference.

    :param mongo: the application database client
    :param pg: the application PostgreSQL engine
    :param document: the reference document
    :return: a list of user data dictionaries

    """
    if not (users := document.get("users")):
        return []

    from virtool.users.pg import SQLUser

    user_ids = [user["id"] for user in users]

    if not user_ids:
        return []

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLUser.id, SQLUser.handle).where(SQLUser.id.in_(user_ids)),
        )

        user_rows = result.all()

    user_map = {row.id: {"id": row.id, "handle": row.handle} for row in user_rows}

    return [
        {**user, **user_data}
        for user in users
        if (user_data := user_map.get(user["id"]))
    ]


async def check_right(req: Request, ref_id: str, right: str) -> bool:
    client: UserClient = req["client"]

    if client.administrator_role == AdministratorRole.FULL:
        return True

    reference = await get_mongo_from_req(req).references.find_one(
        ref_id,
        ["groups", "users"],
    )

    if reference is None:
        raise ResourceNotFoundError()

    groups: list[dict] = reference["groups"]
    users: list[dict] = reference["users"]

    if right == "read":
        if any(user["id"] == client.user_id for user in users):
            return True

        return any(group["id"] in client.groups for group in groups)

    for user in users:
        if user["id"] == client.user_id:
            if user[right]:
                return True

            break

    return any(group[right] and group["id"] in client.groups for group in groups)


async def check_source_type(mongo: "Mongo", ref_id: str, source_type: str) -> bool:
    """Check `source_type` is valid based on the reference configuration.

    :param mongo: the application MongoDB client
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    document = await mongo.references.find_one(
        ref_id,
        ["restrict_source_types", "source_types"],
    )

    restrict_source_types = document.get("restrict_source_types", False)
    source_types = document.get("source_types", [])

    if source_type == "unknown":
        return True

    # Return `False` when source_types are restricted and source_type is not allowed.
    if source_type and restrict_source_types:
        return source_type in source_types

    # Return `True` when:
    # - source_type is empty string (unknown)
    # - source_types are not restricted
    # - source_type is an allowed source_type
    return True


def compose_archived_filter(archived: bool | None) -> dict:
    """Compose a Mongo filter on ``references.archived`` for the project-wide
    ``bool | None`` lifecycle convention.

    - ``None`` (default): no constraint → ``{}`` (both states)
    - ``True``: only archived references → ``{"archived": True}``
    - ``False``: only active references → ``{"archived": False}``

    :param archived: lifecycle filter mode
    :return: a Mongo filter dict for the ``archived`` field

    """
    if archived is None:
        return {}
    return {"archived": archived}


def compose_rights_filter(
    user_id: int,
    administrator: bool,
    groups: list[int | str],
) -> dict:
    """Compose a Mongo filter restricting reference results to those the
    requesting user has read rights to.

    Administrators bypass the filter and receive an empty dict.

    :param user_id: the id of the user requesting the search
    :param administrator: the administrator flag of the user requesting the search
    :param groups: the id group membership of the user requesting the search
    :return: a Mongo filter dict; empty for administrators

    """
    if administrator:
        return {}

    user_queries = [
        {"users.id": user_id},
        {"user.id": user_id},
    ]

    return {
        "$or": [
            {"groups.id": {"$in": groups}},
            *user_queries,
        ],
    }


async def get_contributors(pg, ref_id: str) -> list[Document] | None:
    """Return a list of contributors and their contribution count for a specific ref.

    :param pg: the PostgreSQL engine
    :param ref_id: the id of the ref to get contributors for
    :return: a list of contributors to the ref

    """
    return await virtool.history.db.get_contributors(pg, reference_id=ref_id)


async def get_latest_build(
    mongo: "Mongo", pg: AsyncEngine, ref_id: str
) -> Document | None:
    """Return the latest index build for the ref.

    :param mongo: the application database client
    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the ref to get the latest build for
    :return: a subset of fields for the latest build

    """
    latest_build = await mongo.indexes.find_one(
        {"reference.id": ref_id, "ready": True},
        projection=["created_at", "version", "user", "has_json"],
        sort=[("version", pymongo.DESCENDING)],
    )

    if latest_build:
        return await apply_transforms(
            base_processor(latest_build),
            [AttachUserTransform(pg)],
            pg,
        )


async def get_manifest(mongo: "Mongo", ref_id: str) -> Document:
    """Generate a dict of otu document version numbers keyed by the document id.

    This is used to make sure only changes made at the time the index rebuild was
    started are included in the build.

    :param mongo: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: a manifest of otu ids and versions

    """
    return {
        document["_id"]: document["version"]
        async for document in mongo.otus.find(
            {"reference.id": ref_id},
            ["version"],
        )
    }


async def get_otu_count(mongo: "Mongo", ref_id: str) -> int:
    """Get the number of OTUs associated with the given `ref_id`.

    :param mongo: the application database client
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    return await mongo.otus.count_documents({"reference.id": ref_id})


async def get_unbuilt_count(pg: AsyncEngine, ref_id: str) -> int:
    """Return a count of unbuilt history changes associated with a given `ref_id`.

    :param pg: the application PostgreSQL database object
    :param ref_id: the id of the ref to count unbuilt changes for
    :return: the number of unbuilt changes

    """
    async with AsyncSession(pg) as session:
        return await session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistory)
            .where(
                SQLLegacyHistory.reference == ref_id,
                SQLLegacyHistory.index.is_(None),
            ),
        )


async def create_clone(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    clone_from: str,
    description: str,
    user_id: int,
) -> Document:
    source = await mongo.references.find_one(clone_from)

    name = name or "Clone of " + source["name"]

    document = await create_document(
        mongo,
        settings,
        name,
        source["organism"],
        description,
        source["data_type"],
        created_at=virtool.utils.timestamp(),
        user_id=user_id,
    )

    document["cloned_from"] = {"id": clone_from, "name": source["name"]}

    return document


async def create_document(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    organism: str | None,
    description: str,
    data_type: str | None,
    created_at: datetime,
    ref_id: str | None = None,
    user_id: int | None = None,
    users=None,
):
    if ref_id and await mongo.references.count_documents({"_id": ref_id}):
        raise DatabaseError("ref_id already exists")

    ref_id = ref_id or await virtool.mongo.utils.get_new_id(mongo.references)

    user = None

    if user_id:
        user = {"id": user_id}

    if not users:
        users = [
            {
                "id": user_id,
                "build": True,
                "modify": True,
                "modify_otu": True,
                "created_at": created_at,
                "remove": True,
            }
        ]

    document = {
        "_id": ref_id,
        "archived": False,
        "created_at": created_at,
        "data_type": data_type,
        "description": description,
        "name": name,
        "organism": organism,
        "restrict_source_types": False,
        "source_types": settings.default_source_types,
        "space": {"id": 0},
        "groups": [],
        "users": users,
        "user": user,
    }

    return document


async def create_import(
    mongo: "Mongo",
    settings: Settings,
    name: str,
    description: str,
    upload_id: int,
    user_id: int,
    data_type: str,
    organism: str,
) -> dict:
    """Import a previously exported Virtool reference.

    :param mongo: the application database client
    :param settings: the application settings object
    :param name: the name for the new reference
    :param description: a description for the new reference
    :param upload_id: the id of the uploaded file to import from
    :param user_id: the id of the creating user
    :param data_type: the data type of the reference
    :param organism: the organism
    :return: a reference document

    """
    created_at = virtool.utils.timestamp()

    document = await create_document(
        mongo,
        settings,
        name or "Unnamed Import",
        organism,
        description,
        data_type,
        created_at=created_at,
        user_id=user_id,
    )

    document["imported_from"] = {"id": upload_id}

    return document


async def populate_insert_only_reference(
    created_at: datetime,
    history_method: HistoryMethod,
    mongo: "Mongo",
    pg: AsyncEngine,
    otus: list[dict],
    reference_id: str,
    user_id: int,
) -> None:
    insertions = [
        prepare_otu_insertion(
            created_at,
            history_method,
            otu,
            reference_id,
            user_id,
        )
        for otu in otus
    ]

    diff_rows = [
        {"change_id": insertion.history.id, "diff": insertion.history.diff}
        for insertion in insertions
    ]

    await bulk_insert_history(
        pg,
        diff_rows,
        [insertion.history.document for insertion in insertions],
    )

    try:
        sequences = []

        for insertion in insertions:
            sequences.extend(insertion.sequences)

        async with asyncio.TaskGroup() as tg:
            tg.create_task(
                mongo.otus.insert_many(
                    [insertion.otu for insertion in insertions],
                    None,
                ),
            )
            tg.create_task(mongo.sequences.insert_many(sequences, None))
    except Exception:
        await bulk_delete_history(pg, [row["change_id"] for row in diff_rows])

        await asyncio.gather(
            mongo.sequences.delete_many({"reference.id": reference_id}),
            mongo.otus.delete_many({"reference.id": reference_id}),
        )

        await mongo.references.delete_one({"_id": reference_id})
        raise


def lookup_nested_reference_by_id(
    local_field: str = "reference.id",
    set_as: str = "reference",
) -> list[dict]:
    """Create a mongoDB aggregation pipeline step to look up nested reference by id.

    :param local_field: reference field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "references",
                "let": {"reference_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$reference_id"]}}},
                    {"$project": {"_id": True, "name": True, "data_type": True}},
                ],
                "as": set_as,
            },
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]
