"""Backfill logic for copying Mongo references into Postgres.

This module holds the idempotent copy used by the reference backfill revision. It
is kept here rather than inline in the revision so it can be unit tested and
reused.
"""

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import compose_legacy_id_single_expression
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext
from virtool.pg.base import Base
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)
from virtool.references.utils import reference_values
from virtool.tasks.sql import SQLTask
from virtool.uploads.sql import SQLUpload
from virtool.users.pg import SQLUser

logger = get_logger("migration")


async def copy_references_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``references`` document into Postgres.

    One row is written per Mongo document into ``legacy_references``, plus one row
    per member of the embedded ``users`` and ``groups`` rights arrays into the
    ``legacy_reference_users`` and ``legacy_reference_groups`` join tables.
    Documents are processed one at a time and committed individually, so memory
    stays bounded and a failure part-way through keeps the rows already written
    rather than rolling back the whole collection.

    The document ``_id`` values are snapshotted up front so the rest of the run
    fetches one document at a time by id, rather than holding a single Mongo cursor
    open for the entire migration.

    The parent row and its rights rows are inserted in a single transaction and
    committed together, so a committed reference always carries its complete set of
    rights rows. Documents already present in Postgres (by ``legacy_id``) are
    therefore skipped wholesale, and every insert uses ``ON CONFLICT DO NOTHING``
    as a second line of defence, so the backfill is safe to re-run after an
    interruption.

    Foreign keys are resolved from their Mongo references to Postgres primary keys.
    ``compose_legacy_id_single_expression`` tolerates both legacy string ids and
    the integer ids written since those collections were migrated:

    - ``user`` is required, both as the reference owner and as a ``users`` rights
      member, because users are never hard-deleted (only deactivated). A reference
      that references a user missing from Postgres raises, rather than being
      backfilled with a null owner or a dropped grant.
    - ``groups`` rights members are best-effort. Groups can be deleted without
      scrubbing the grant from the reference document, so a member that no longer
      resolves is logged and skipped rather than aborting the migration.
    - ``upload`` (``imported_from``) and ``task`` are optional. A dangling
      reference is backfilled as ``NULL`` and logged with a warning.

    The ``cloned_from_id`` self-foreign key is resolved in a second pass, once
    every reference row exists, so a clone written before its source can still be
    linked. See :func:`_backfill_cloned_from_ids`.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLReference.legacy_id).where(
                SQLReference.legacy_id.isnot(None),
            ),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing references in postgres",
            count=len(existing_legacy_ids),
        )

        reference_ids = [
            document["_id"]
            async for document in ctx.mongo.references.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        user_id_cache: dict[int | str, int | None] = {}
        group_id_cache: dict[int | str, int | None] = {}
        upload_id_cache: dict[int | str, int | None] = {}
        task_id_cache: dict[int | str, int | None] = {}

        for reference_id in reference_ids:
            if reference_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.references.find_one({"_id": reference_id})

            if document is None:
                skipped_count += 1
                continue

            user_id = await _resolve_user_id(session, document, user_id_cache)
            upload_id = await _resolve_upload_id(session, document, upload_id_cache)
            task_id = await _resolve_task_id(session, document, task_id_cache)

            reference_pk = (
                await session.execute(
                    insert(SQLReference)
                    .values(
                        **reference_values(
                            document,
                            user_id=user_id,
                            upload_id=upload_id,
                            cloned_from_id=None,
                            task_id=task_id,
                        ),
                    )
                    .on_conflict_do_nothing(index_elements=["legacy_id"])
                    .returning(SQLReference.id),
                )
            ).scalar_one_or_none()

            if reference_pk is None:
                reference_pk = (
                    await session.execute(
                        select(SQLReference.id).where(
                            SQLReference.legacy_id == reference_id,
                        ),
                    )
                ).scalar_one()

            await _insert_rights_rows(
                session,
                reference_pk,
                document,
                user_id_cache,
                group_id_cache,
            )
            await session.commit()

            migrated_count += 1

        logger.info(
            "reference migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )

        await _backfill_cloned_from_ids(ctx, session)


async def _insert_rights_rows(
    session: AsyncSession,
    reference_pk: int,
    document: dict,
    user_id_cache: dict[int | str, int | None],
    group_id_cache: dict[int | str, int | None],
) -> None:
    """Insert the user and group rights rows for a reference.

    User grants are required: users are never hard-deleted, so a ``users`` member
    that does not resolve raises. Group grants are best-effort: a group can be
    deleted without scrubbing the grant from the reference document, so a
    ``groups`` member that does not resolve is logged and skipped. Each insert uses
    ``ON CONFLICT DO NOTHING`` so a re-run over an interrupted document adds only
    the rows that are missing.
    """
    for member in document.get("users") or []:
        user_id = await _resolve_rights_member_id(
            session,
            SQLUser,
            member["id"],
            user_id_cache,
            document["_id"],
            "user",
        )

        await session.execute(
            insert(SQLReferenceUser)
            .values(
                reference_id=reference_pk,
                user_id=user_id,
                build=member.get("build", False),
                modify=member.get("modify", False),
                modify_otu=member.get("modify_otu", False),
            )
            .on_conflict_do_nothing(),
        )

    for member in document.get("groups") or []:
        group_id = await _resolve_id(session, SQLGroup, member["id"], group_id_cache)

        if group_id is None:
            logger.warning(
                "reference grants rights to a group that no longer exists; "
                "skipping grant",
                reference_id=document["_id"],
                group=member["id"],
            )
            continue

        await session.execute(
            insert(SQLReferenceGroup)
            .values(
                reference_id=reference_pk,
                group_id=group_id,
                build=member.get("build", False),
                modify=member.get("modify", False),
                modify_otu=member.get("modify_otu", False),
            )
            .on_conflict_do_nothing(),
        )


async def _backfill_cloned_from_ids(
    ctx: MigrationContext,
    session: AsyncSession,
) -> None:
    """Resolve the ``cloned_from_id`` self-foreign key for cloned references.

    This runs after every reference row exists, so a clone written before its
    source can still be linked. Each ``UPDATE`` is guarded by
    ``cloned_from_id IS NULL`` so a re-run only touches rows not already linked,
    and a source that no longer resolves is logged and left ``NULL`` rather than
    failing the migration.
    """
    linked_count = 0

    async for document in ctx.mongo.references.find(
        {"cloned_from": {"$ne": None}},
        projection=["_id", "cloned_from"],
    ):
        cloned_from = document.get("cloned_from")

        if not cloned_from:
            continue

        cloned_from_id = (
            await session.execute(
                select(SQLReference.id).where(
                    compose_legacy_id_single_expression(
                        SQLReference,
                        cloned_from["id"],
                    ),
                ),
            )
        ).scalar_one_or_none()

        if cloned_from_id is None:
            logger.warning(
                "reference was cloned from a source missing in postgres; "
                "leaving cloned_from_id null",
                reference_id=document["_id"],
                cloned_from=cloned_from["id"],
            )
            continue

        result = await session.execute(
            update(SQLReference)
            .where(
                SQLReference.legacy_id == document["_id"],
                SQLReference.cloned_from_id.is_(None),
            )
            .values(cloned_from_id=cloned_from_id),
        )
        await session.commit()

        linked_count += result.rowcount

    logger.info("backfilled reference cloned_from_id", linked=linked_count)


async def _resolve_id(
    session: AsyncSession,
    model: type[Base],
    reference: int | str,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a Mongo reference to a Postgres primary key, memoising results.

    The reference may be a legacy string id or a modern integer id. The resolved
    id (or ``None`` if no row matches) is cached by reference so that references
    sharing the same user do not each issue a query.
    """
    if reference in cache:
        return cache[reference]

    resolved = (
        await session.execute(
            select(model.id).where(
                compose_legacy_id_single_expression(model, reference),
            ),
        )
    ).scalar_one_or_none()

    cache[reference] = resolved

    return resolved


async def _resolve_user_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int:
    """Resolve a document's ``user`` reference to a Postgres ``users.id``.

    A reference always has an owner, so a missing ``user`` reference or one that no
    longer resolves to a Postgres row raises rather than being backfilled as
    ``NULL``.
    """
    user = document.get("user")

    if not user or "id" not in user:
        msg = f"reference {document['_id']!r} has no user reference"
        raise ValueError(msg)

    reference = user["id"]

    user_id = await _resolve_id(session, SQLUser, reference, cache)

    if user_id is None:
        msg = (
            f"reference {document['_id']!r} references user {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    return user_id


async def _resolve_upload_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a document's ``imported_from`` upload to a Postgres ``uploads.id``.

    Returns ``None`` when the reference was not imported, and also when an upload
    is referenced but no longer exists in Postgres. Dangling references are logged
    so the migration leaves an audit trail, distinct from the legitimate
    not-imported case.
    """
    imported_from = document.get("imported_from")

    if not imported_from or "id" not in imported_from:
        return None

    reference = imported_from["id"]

    upload_id = await _resolve_id(session, SQLUpload, reference, cache)

    if upload_id is None:
        logger.warning(
            "reference references an upload that no longer exists; "
            "backfilling null upload_id",
            reference_id=document["_id"],
            upload=reference,
        )

    return upload_id


async def _resolve_task_id(
    session: AsyncSession,
    document: dict,
    cache: dict[int | str, int | None],
) -> int | None:
    """Resolve a document's ``task`` reference to a Postgres ``tasks.id``.

    Returns ``None`` when the reference has no task, and also when a task is
    referenced but no longer exists in Postgres. Dangling references are logged so
    the migration leaves an audit trail, distinct from the legitimate no-task case.

    ``tasks`` was born in Postgres with integer ids and has no ``legacy_id``
    column, so a non-integer task reference can never resolve and would make
    ``compose_legacy_id_single_expression`` raise. Such a value is treated as a
    dangling reference and nulled rather than aborting the backfill.
    """
    task = document.get("task")

    if not task or "id" not in task:
        return None

    reference = task["id"]

    if not isinstance(reference, int) and not (
        isinstance(reference, str) and reference.isdigit()
    ):
        logger.warning(
            "reference references a task with a non-integer id; "
            "backfilling null task_id",
            reference_id=document["_id"],
            task=reference,
        )
        return None

    task_id = await _resolve_id(session, SQLTask, reference, cache)

    if task_id is None:
        logger.warning(
            "reference references a task that no longer exists; "
            "backfilling null task_id",
            reference_id=document["_id"],
            task=reference,
        )

    return task_id


async def _resolve_rights_member_id(
    session: AsyncSession,
    model: type[Base],
    reference: int | str,
    cache: dict[int | str, int | None],
    reference_id: str,
    kind: str,
) -> int:
    """Resolve a required rights member's id to a Postgres primary key.

    Used for ``users`` grants, which must always resolve because users are never
    hard-deleted. A member that does not resolve raises rather than being skipped
    or backfilled as ``NULL``, matching the not-null foreign key on the join table.
    """
    resolved = await _resolve_id(session, model, reference, cache)

    if resolved is None:
        msg = (
            f"reference {reference_id!r} grants rights to {kind} {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    return resolved
