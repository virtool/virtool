"""Work with references in the database"""

import asyncio
import datetime
from typing import TYPE_CHECKING

import pymongo
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio.engine import AsyncEngine

import virtool.history.db
import virtool.utils
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.data.topg import (
    compose_legacy_id_mongo_match,
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.history.db import bulk_insert_history
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.otus.db import bulk_insert_otu_rows, bulk_insert_sequence_rows
from virtool.otus.sql import SQLOTU
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
    from virtool.mongo.core import Mongo


async def compose_reference_id_match(pg: AsyncEngine, ref_id: int | str) -> dict:
    """Build a Mongo match value for an embedded ``reference.id``.

    While the ``references`` migration is in progress, ``otus`` and ``sequences``
    documents may carry either the legacy Mongo string id or the integer
    ``legacy_references`` primary key, so both forms must match.
    """
    return await compose_legacy_id_mongo_match(pg, SQLReference, ref_id)


async def write_legacy_reference(
    pg_session: AsyncSession,
    document: Document,
) -> int:
    """Insert a ``legacy_references`` row and its seeded rights from a reference
    ``document`` into the open Postgres session and return the new primary key.

    ``legacy_id`` is taken from the document's ``_id`` when present and is otherwise
    left ``NULL`` for a Postgres-native reference.

    ``cloned_from`` holds the source reference's id, which is resolved to its Postgres
    primary key. If the source has no Postgres row yet, the foreign key is left ``NULL``
    for the backfill to fill in later.
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

    return reference.id


def map_reference_minimal(
    row: SQLReference,
    cloned_from: Document | None,
) -> Document:
    """Shape a ``legacy_references`` row into the base reference document consumed by
    the ``ReferenceMinimal`` model and the read transforms.

    ``data_type`` is emitted as the constant ``"genome"`` because the column is
    dropped from Postgres. The integer foreign keys are shaped into the nested
    ``{"id": ...}`` forms the ``AttachUserTransform``, ``AttachTaskTransform`` and
    ``AttachImportedFromTransform`` transforms expect. ``cloned_from`` is resolved by
    the caller via :func:`get_cloned_from_lookup`.

    :param row: a ``legacy_references`` row
    :param cloned_from: the resolved nested cloned-from doc, or ``None``
    :return: the base reference document
    """
    return {
        "id": row.id,
        "name": row.name,
        "organism": row.organism,
        "created_at": row.created_at,
        "archived": row.archived,
        "data_type": "genome",
        "cloned_from": cloned_from,
        "imported_from": {"id": row.upload_id} if row.upload_id is not None else None,
        "task": {"id": row.task_id} if row.task_id is not None else None,
        "user": row.user_id,
    }


async def get_cloned_from_lookup(
    session: AsyncSession,
    rows: list[SQLReference],
) -> dict[int, Document]:
    """Map each source ``cloned_from_id`` in ``rows`` to its nested cloned-from doc.

    The denormalized ``cloned_from.name`` snapshot is not stored in Postgres; the
    source reference's current ``name`` is re-derived here via its primary key.

    :param session: an active Postgres session
    :param rows: the reference rows whose ``cloned_from`` docs are needed
    :return: a mapping of source primary key to nested cloned-from doc
    """
    source_ids = {row.cloned_from_id for row in rows if row.cloned_from_id is not None}

    if not source_ids:
        return {}

    result = await session.execute(
        select(SQLReference.id, SQLReference.name).where(
            SQLReference.id.in_(source_ids),
        ),
    )

    return {id_: {"id": id_, "name": name} for id_, name in result}


async def processor(
    mongo: "Mongo",
    pg: AsyncEngine,
    row: SQLReference,
    cloned_from: Document | None,
) -> Document:
    """Process a reference row into the ``ReferenceMinimal`` document shape.

    :param mongo: the application Mongo client
    :param pg: the application PostgreSQL engine
    :param row: the ``legacy_references`` row to process
    :param cloned_from: the resolved nested cloned-from doc, or ``None``
    :return: the processed document
    """
    latest_build, otu_count, unbuilt_count = await asyncio.gather(
        get_latest_build(mongo, pg, row.id),
        get_otu_count(pg, row.id),
        get_unbuilt_count(pg, row.id),
    )

    return {
        **map_reference_minimal(row, cloned_from),
        "latest_build": latest_build,
        "otu_count": otu_count,
        "unbuilt_change_count": unbuilt_count,
    }


async def get_reference_groups(
    pg: AsyncEngine,
    reference_pk: int,
    created_at: datetime.datetime,
) -> list[Document]:
    """Get a detailed list of groups that have access to the specified reference.

    Membership and rights are read from the ``legacy_reference_groups`` child
    table and enriched with the group name from ``groups``. Each entry inherits
    the reference's ``created_at`` because per-member timestamps are not stored
    in Postgres.

    :param pg: the application Postgres engine
    :param reference_pk: the reference primary key
    :param created_at: the reference's creation timestamp
    :return: a list of group data dictionaries

    """
    async with AsyncSession(pg) as session:
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
            "created_at": created_at,
        }
        for row in rows
    ]


async def get_reference_users(
    pg: AsyncEngine,
    reference_pk: int,
    created_at: datetime.datetime,
) -> list[Document]:
    """Get a detailed list of users that have access to the specified reference.

    Membership and rights are read from the ``legacy_reference_users`` child
    table and enriched with the user handle from ``users``. Each entry inherits
    the reference's ``created_at`` because per-member timestamps are not stored
    in Postgres.

    :param pg: the application PostgreSQL engine
    :param reference_pk: the reference primary key
    :param created_at: the reference's creation timestamp
    :return: a list of user data dictionaries

    """
    from virtool.users.pg import SQLUser

    async with AsyncSession(pg) as session:
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
            "created_at": created_at,
        }
        for row in rows
    ]


async def check_source_type(
    pg: AsyncEngine,
    ref_id: int | str,
    source_type: str,
) -> bool:
    """Check `source_type` is valid based on the reference configuration.

    :param pg: the application PostgreSQL engine
    :param ref_id: the reference context
    :param source_type: the source type to check
    :return: source type is valid

    """
    if source_type == "unknown":
        return True

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(
                    SQLReference.restrict_source_types,
                    SQLReference.source_types,
                ).where(compose_legacy_id_single_expression(SQLReference, ref_id)),
            )
        ).one_or_none()

    if row is None:
        raise ResourceError(f"Could not find reference {ref_id} in postgres")

    # Return `False` when source_types are restricted and source_type is not allowed.
    if source_type and row.restrict_source_types:
        return source_type in row.source_types

    # Return `True` when:
    # - source_type is empty string (unknown)
    # - source_types are not restricted
    # - source_type is an allowed source_type
    return True


async def compose_reference_ids_match(
    pg: AsyncEngine,
    archived: bool | None = None,
) -> dict:
    """Build a Mongo ``reference.id`` match for the references matching ``archived``.

    The lifecycle filter follows the project-wide ``bool | None`` convention: ``None``
    places no constraint, ``True`` selects archived references and ``False`` selects
    active ones.

    ``indexes`` documents embed either the legacy Mongo string reference id or the
    integer ``legacy_references`` primary key during the migration, so both forms
    are included for every matching reference. This backs the orphan and lifecycle
    filters on the index list, which scope indexes to references that still exist.

    A Postgres-native reference has no ``legacy_id``; only its primary key is
    contributed to the match.

    :param pg: the application PostgreSQL engine
    :param archived: lifecycle filter mode
    :return: a Mongo ``$in`` match value covering both id forms
    """
    query = select(SQLReference.id, SQLReference.legacy_id)

    if archived is not None:
        query = query.where(SQLReference.archived == archived)

    async with AsyncSession(pg) as session:
        rows = (await session.execute(query)).all()

    return {"$in": [value for row in rows for value in row if value is not None]}


async def get_contributors(pg, ref_id: int | str) -> list[Document] | None:
    """Return a list of contributors and their contribution count for a specific ref.

    :param pg: the PostgreSQL engine
    :param ref_id: the id of the ref to get contributors for
    :return: a list of contributors to the ref

    """
    return await virtool.history.db.get_contributors(pg, reference_id=ref_id)


async def get_latest_build(
    mongo: "Mongo", pg: AsyncEngine, ref_id: int | str
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
        projection=["created_at", "version", "user"],
        sort=[("version", pymongo.DESCENDING)],
    )

    if latest_build:
        return await apply_transforms(
            base_processor(latest_build),
            [AttachUserTransform(pg)],
            pg,
        )


async def get_manifest(pg: AsyncEngine, ref_id: int | str) -> Document:
    """Generate a dict of otu document version numbers keyed by the document id.

    This is used to make sure only changes made at the time the index rebuild was
    started are included in the build.

    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to get the current index for
    :return: a manifest of otu ids and versions

    """
    async with AsyncSession(pg) as session:
        rows = await session.execute(
            select(SQLOTU.id, SQLOTU.version).where(
                SQLOTU.reference_id == compose_legacy_id_subquery(SQLReference, ref_id),
            ),
        )

    return {row.id: row.version for row in rows}


async def get_otu_count(pg: AsyncEngine, ref_id: int | str) -> int:
    """Get the number of OTUs associated with the given `ref_id`.

    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to get the current index for
    :return: the OTU count

    """
    async with AsyncSession(pg) as session:
        return await session.scalar(
            select(func.count())
            .select_from(SQLOTU)
            .where(
                SQLOTU.reference_id == compose_legacy_id_subquery(SQLReference, ref_id),
            ),
        )


async def get_unbuilt_count(pg: AsyncEngine, ref_id: int | str) -> int:
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
    pg: AsyncEngine,
    settings: Settings,
    name: str,
    clone_from: int | str,
    description: str,
    user_id: int,
) -> Document:
    async with AsyncSession(pg) as session:
        source = (
            await session.execute(
                select(SQLReference.name, SQLReference.organism).where(
                    compose_legacy_id_single_expression(SQLReference, clone_from),
                ),
            )
        ).one_or_none()

    if source is None:
        raise ResourceNotFoundError

    name = name or "Clone of " + source.name

    document = await create_document(
        settings,
        name,
        source.organism,
        description,
        "genome",
        created_at=virtool.utils.timestamp(),
        user_id=user_id,
    )

    document["cloned_from"] = {"id": clone_from, "name": source.name}

    return document


async def create_document(
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
    """Build a reference document for :func:`write_legacy_reference`.

    Pass ``ref_id`` to seed a legacy ``_id`` (mirrored to ``legacy_id``); omit it for
    a Postgres-native reference whose primary key the database assigns.
    """
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

    if ref_id is not None:
        document["_id"] = ref_id

    return document


async def create_import(
    settings: Settings,
    name: str,
    description: str,
    upload_id: int,
    user_id: int,
    data_type: str,
    organism: str,
) -> dict:
    """Import a previously exported Virtool reference.

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


_REFERENCE_OTU_CHUNK_SIZE = 1000
"""Number of OTUs written per transaction in the bulk reference populate paths.

Reference imports and clones can involve tens of thousands of OTUs and 100k+
sequences. Writing them in bounded chunks with a commit per chunk keeps each
transaction small instead of holding one enormous transaction open.
"""


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

    try:
        for start in range(0, len(insertions), _REFERENCE_OTU_CHUNK_SIZE):
            chunk = insertions[start : start + _REFERENCE_OTU_CHUNK_SIZE]

            chunk_otus = [insertion.otu for insertion in chunk]
            chunk_sequences = [
                sequence for insertion in chunk for sequence in insertion.sequences
            ]

            async with AsyncSession(pg) as pg_session:
                await bulk_insert_otu_rows(pg_session, chunk_otus, reference_pk)
                await bulk_insert_sequence_rows(pg_session, chunk_sequences)
                await bulk_insert_history(
                    pg_session,
                    [
                        {
                            "change_id": insertion.history.id,
                            "diff": insertion.history.diff,
                        }
                        for insertion in chunk
                    ],
                    [insertion.history.document for insertion in chunk],
                )
                await pg_session.commit()

            async with asyncio.TaskGroup() as tg:
                tg.create_task(mongo.otus.insert_many(chunk_otus, None))
                tg.create_task(mongo.sequences.insert_many(chunk_sequences, None))
    except Exception:
        await _rollback_insert_only_reference(mongo, pg, reference_id)

        raise


async def _rollback_insert_only_reference(
    mongo: "Mongo",
    pg: AsyncEngine,
    reference_id: str,
) -> None:
    """Undo a partially completed bulk reference populate.

    Deletes every history, OTU, sequence and rights row committed for the reference
    and the reference itself in a single Postgres transaction, then deletes the
    matching Mongo documents. Every Postgres delete is scoped to the reference's
    primary key, so the cleanup is atomic and can never touch history rows that
    belong to another reference. The OTU rows are deleted before the reference
    because ``legacy_otus.reference_id`` has no cascade; the sequence rows cascade
    from their OTUs.
    """
    async with AsyncSession(pg) as session:
        sql_reference_id = (
            await session.execute(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(SQLReference, reference_id),
                ),
            )
        ).scalar_one_or_none()

        if sql_reference_id is not None:
            history_ids = select(SQLLegacyHistory.id).where(
                SQLLegacyHistory.reference_id == sql_reference_id,
            )

            await session.execute(
                delete(SQLLegacyHistoryDiff).where(
                    SQLLegacyHistoryDiff.history_id.in_(history_ids),
                ),
            )
            await session.execute(
                delete(SQLLegacyHistory).where(
                    SQLLegacyHistory.reference_id == sql_reference_id,
                ),
            )
            await session.execute(
                delete(SQLOTU).where(SQLOTU.reference_id == sql_reference_id),
            )
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

    reference_id_match = await compose_reference_id_match(pg, reference_id)

    await asyncio.gather(
        mongo.sequences.delete_many({"reference.id": reference_id_match}),
        mongo.otus.delete_many({"reference.id": reference_id_match}),
    )
