"""Work with references in the database"""

import asyncio
import datetime
from typing import TYPE_CHECKING

import pymongo
from aiohttp.web import Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio.engine import AsyncEngine

import virtool.history.db
import virtool.mongo.utils
import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.data.topg import (
    compose_legacy_id_mongo_match,
    compose_legacy_id_multi_expression,
    compose_legacy_id_multi_mongo_match,
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.history.db import bulk_delete_history, bulk_insert_history
from virtool.history.sql import SQLLegacyHistory
from virtool.models.enums import HistoryMethod
from virtool.models.roles import AdministratorRole
from virtool.references.alot import prepare_otu_insertion
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)
from virtool.references.utils import reference_values
from virtool.settings.models import Settings
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.api.client import UserClient
    from virtool.mongo.core import Mongo


async def compose_reference_id_match(pg: AsyncEngine, ref_id: int | str) -> dict:
    """Build a Mongo match value for an embedded ``reference.id``.

    While the ``references`` migration is in progress, ``otus`` and ``sequences``
    documents may carry either the legacy Mongo string id or the integer
    ``legacy_references`` primary key, so both forms must match.
    """
    return await compose_legacy_id_mongo_match(pg, SQLReference, ref_id)


async def resolve_reference_legacy_id(pg: AsyncEngine, ref_id: int | str) -> str:
    """Return the legacy Mongo string id for a reference.

    ``references`` still live in Mongo keyed by their legacy string ``_id`` while
    ``otus`` and ``sequences`` may already embed the integer
    ``legacy_references`` primary key. Callers that hold an embedded id and need
    to reach the Mongo ``references`` document resolve it here. A legacy string id
    passes through unchanged.
    """
    if isinstance(ref_id, str):
        return ref_id

    async with AsyncSession(pg) as session:
        legacy_id = await session.scalar(
            select(SQLReference.legacy_id).where(SQLReference.id == ref_id),
        )

    if legacy_id is None:
        raise ResourceNotFoundError

    return legacy_id


async def write_legacy_reference(
    pg_session: AsyncSession,
    document: Document,
) -> None:
    """Insert a ``legacy_references`` row and its seeded rights from a Mongo reference
    ``document`` into the open Postgres session.

    ``cloned_from`` holds the source reference's legacy id, which is resolved to its
    Postgres primary key. If the source has no Postgres row yet, the foreign key is left
    ``NULL`` for the backfill to fill in later.
    """
    cloned_from = document.get("cloned_from")

    cloned_from_id = None

    if cloned_from is not None:
        cloned_from_id = (
            await pg_session.execute(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(
                        SQLReference,
                        cloned_from["id"],
                    ),
                ),
            )
        ).scalar_one_or_none()

    user = document.get("user")
    imported_from = document.get("imported_from")
    task = document.get("task")

    reference = SQLReference(
        **reference_values(
            document,
            user_id=user["id"] if user else None,
            upload_id=imported_from["id"] if imported_from else None,
            cloned_from_id=cloned_from_id,
            task_id=task["id"] if task else None,
        ),
    )

    pg_session.add(reference)

    await pg_session.flush()

    for member in document.get("users", []):
        pg_session.add(
            SQLReferenceUser(
                reference_id=reference.id,
                user_id=member["id"],
                build=member.get("build", False),
                modify=member.get("modify", False),
                modify_otu=member.get("modify_otu", False),
            ),
        )

    for member in document.get("groups", []):
        pg_session.add(
            SQLReferenceGroup(
                reference_id=reference.id,
                group_id=member["id"],
                build=member.get("build", False),
                modify=member.get("modify", False),
                modify_otu=member.get("modify_otu", False),
            ),
        )


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
        get_otu_count(mongo, pg, ref_id),
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

    Membership and rights are read from the ``legacy_reference_groups`` child
    table and enriched with the group name from ``groups``. Each entry inherits
    the reference's ``created_at`` because per-member timestamps are not stored
    in Postgres.

    :param pg: the application Postgres engine
    :param document: the reference document
    :return: a list of group data dictionaries

    """
    async with AsyncSession(pg) as session:
        reference_pk = await session.scalar(
            select(SQLReference.id).where(
                compose_legacy_id_single_expression(SQLReference, document["_id"]),
            ),
        )

        if reference_pk is None:
            return []

        rows = (
            await session.execute(
                select(
                    SQLGroup.id,
                    SQLGroup.legacy_id,
                    SQLGroup.name,
                    SQLReferenceGroup.build,
                    SQLReferenceGroup.modify,
                    SQLReferenceGroup.modify_otu,
                )
                .join(SQLGroup, SQLGroup.id == SQLReferenceGroup.group_id)
                .where(SQLReferenceGroup.reference_id == reference_pk)
                .order_by(SQLReferenceGroup.group_id),
            )
        ).all()

    return [
        {
            "id": row.id,
            "legacy_id": row.legacy_id,
            "name": row.name,
            "build": row.build,
            "modify": row.modify,
            "modify_otu": row.modify_otu,
            "created_at": document["created_at"],
        }
        for row in rows
    ]


async def get_reference_users(pg: AsyncEngine, document: Document) -> list[Document]:
    """Get a detailed list of users that have access to the specified reference.

    Membership and rights are read from the ``legacy_reference_users`` child
    table and enriched with the user handle from ``users``. Each entry inherits
    the reference's ``created_at`` because per-member timestamps are not stored
    in Postgres.

    :param pg: the application PostgreSQL engine
    :param document: the reference document
    :return: a list of user data dictionaries

    """
    from virtool.users.pg import SQLUser

    async with AsyncSession(pg) as session:
        reference_pk = await session.scalar(
            select(SQLReference.id).where(
                compose_legacy_id_single_expression(SQLReference, document["_id"]),
            ),
        )

        if reference_pk is None:
            return []

        rows = (
            await session.execute(
                select(
                    SQLUser.id,
                    SQLUser.handle,
                    SQLReferenceUser.build,
                    SQLReferenceUser.modify,
                    SQLReferenceUser.modify_otu,
                )
                .join(SQLUser, SQLUser.id == SQLReferenceUser.user_id)
                .where(SQLReferenceUser.reference_id == reference_pk)
                .order_by(SQLReferenceUser.user_id),
            )
        ).all()

    return [
        {
            "id": row.id,
            "handle": row.handle,
            "build": row.build,
            "modify": row.modify,
            "modify_otu": row.modify_otu,
            "created_at": document["created_at"],
        }
        for row in rows
    ]


async def check_right(req: Request, ref_id: int | str, right: str) -> bool:
    client: UserClient = req["client"]

    if client.administrator_role == AdministratorRole.FULL:
        return True

    async with AsyncSession(req.app["pg"]) as session:
        reference_pk = await session.scalar(
            select(SQLReference.id).where(
                compose_legacy_id_single_expression(SQLReference, ref_id),
            ),
        )

        if reference_pk is None:
            raise ResourceNotFoundError

        if client.user_id is not None:
            user_query = select(SQLReferenceUser.reference_id).where(
                SQLReferenceUser.reference_id == reference_pk,
                SQLReferenceUser.user_id == client.user_id,
            )

            if right != "read":
                user_query = user_query.where(
                    getattr(SQLReferenceUser, right).is_(True),
                )

            if await session.scalar(user_query.limit(1)) is not None:
                return True

        if client.groups:
            group_query = (
                select(SQLReferenceGroup.reference_id)
                .join(SQLGroup, SQLGroup.id == SQLReferenceGroup.group_id)
                .where(
                    SQLReferenceGroup.reference_id == reference_pk,
                    compose_legacy_id_multi_expression(SQLGroup, client.groups),
                )
            )

            if right != "read":
                group_query = group_query.where(
                    getattr(SQLReferenceGroup, right).is_(True),
                )

            if await session.scalar(group_query.limit(1)) is not None:
                return True

    return False


async def check_source_type(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: int | str,
    source_type: str,
) -> bool:
    """Check `source_type` is valid based on the reference configuration.

    :param mongo: the application MongoDB client
    :param pg: the application PostgreSQL engine
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    ref_id = await resolve_reference_legacy_id(pg, ref_id)

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


async def compose_reference_ids_match(
    pg: AsyncEngine,
    mongo: "Mongo",
    archived: bool | None = None,
) -> dict:
    """Build a Mongo ``reference.id`` match for the references matching ``archived``.

    ``indexes`` documents embed either the legacy Mongo string reference id or the
    integer ``legacy_references`` primary key during the migration, so both forms
    are included for every matching reference. This backs the orphan and lifecycle
    filters on the index list, which scope indexes to references that still exist.

    :param pg: the application PostgreSQL engine
    :param mongo: the application database client
    :param archived: lifecycle filter mode; see :func:`compose_archived_filter`
    :return: a Mongo ``$in`` match value covering both id forms
    """
    legacy_ids = await mongo.references.distinct(
        "_id",
        compose_archived_filter(archived),
    )

    return await compose_legacy_id_multi_mongo_match(pg, SQLReference, legacy_ids)


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
        {
            "reference.id": await compose_reference_id_match(pg, ref_id),
            "ready": True,
        },
        projection=["created_at", "version", "user", "has_json"],
        sort=[("version", pymongo.DESCENDING)],
    )

    if latest_build:
        return await apply_transforms(
            base_processor(latest_build),
            [AttachUserTransform(pg)],
            pg,
        )


async def get_manifest(mongo: "Mongo", pg: AsyncEngine, ref_id: str) -> Document:
    """Generate a dict of otu document version numbers keyed by the document id.

    This is used to make sure only changes made at the time the index rebuild was
    started are included in the build.

    :param mongo: the application database client
    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to get the current index for
    :return: a manifest of otu ids and versions

    """
    return {
        document["_id"]: document["version"]
        async for document in mongo.otus.find(
            {"reference.id": await compose_reference_id_match(pg, ref_id)},
            ["version"],
        )
    }


async def get_otu_count(mongo: "Mongo", pg: AsyncEngine, ref_id: str) -> int:
    """Get the number of OTUs associated with the given `ref_id`.

    :param mongo: the application database client
    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    return await mongo.otus.count_documents(
        {"reference.id": await compose_reference_id_match(pg, ref_id)},
    )


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
                SQLLegacyHistory.reference_id
                == compose_legacy_id_subquery(SQLReference, ref_id),
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
    async with AsyncSession(pg) as session:
        reference_pk = await resolve_legacy_id(session, SQLReference, reference_id)

    if reference_pk is None:
        raise ValueError(f"Reference {reference_id!r} not found in postgres")

    insertions = [
        prepare_otu_insertion(
            created_at,
            history_method,
            otu,
            reference_pk,
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

        reference_id_match = await compose_reference_id_match(pg, reference_id)

        await asyncio.gather(
            mongo.sequences.delete_many({"reference.id": reference_id_match}),
            mongo.otus.delete_many({"reference.id": reference_id_match}),
        )

        await mongo.references.delete_one({"_id": reference_id})

        async with AsyncSession(pg) as session:
            sql_reference_id = (
                await session.execute(
                    select(SQLReference.id).where(
                        SQLReference.legacy_id == reference_id,
                    ),
                )
            ).scalar_one_or_none()

            if sql_reference_id is not None:
                await session.execute(
                    delete(SQLReferenceUser).where(
                        SQLReferenceUser.reference_id == sql_reference_id,
                    ),
                )
                await session.execute(
                    delete(SQLReferenceGroup).where(
                        SQLReferenceGroup.reference_id == sql_reference_id,
                    ),
                )
                await session.execute(
                    delete(SQLReference).where(SQLReference.id == sql_reference_id),
                )

            await session.commit()

        raise
