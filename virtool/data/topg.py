"""Helpers for migrating MongoDB resources to PostgreSQL."""

from sqlalchemy import ColumnExpressionArgument, ScalarSelect, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.pg.base import HasLegacyAndModernIDs


def compose_legacy_id_multi_expression(
    model: HasLegacyAndModernIDs,
    id_list: list[int | str] | set[int | str] | tuple[int | str],
) -> ColumnExpressionArgument[bool]:
    """Compose a query that will match legacy (str) and modern (int) resource ids in
    ``id_list``.

    :param id_list: a list of legacy ids
    :param model: the SQLAlchemy model to query
    :return: a MongoDB query

    """
    if not id_list:
        raise ValueError("id_list must not be empty")

    modern_ids = []
    legacy_ids = []

    for id_ in set(id_list):
        if isinstance(id_, int):
            modern_ids.append(id_)
        elif isinstance(id_, str) and id_.isdigit():
            modern_ids.append(int(id_))
        else:
            legacy_ids.append(id_)

    if legacy_ids and modern_ids:
        return or_(model.id.in_(modern_ids), model.legacy_id.in_(legacy_ids))

    if modern_ids:
        return model.id.in_(modern_ids)

    return model.legacy_id.in_(legacy_ids)


def compose_legacy_id_single_expression(
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> ColumnExpressionArgument[bool]:
    """Compose a query that will match a single legacy (str) or modern (int) resource id.

    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: a column expression for the query

    """
    if isinstance(id_, int):
        return model.id == id_

    # Check if string ID is actually a stringified integer
    if isinstance(id_, str) and id_.isdigit():
        return model.id == int(id_)

    return model.legacy_id == id_


def compose_legacy_id_subquery(
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> ScalarSelect:
    """Build a scalar subquery resolving a legacy (str) or modern (int) resource id to
    the integer ``id`` of the matching row in ``model``.

    Use this to filter or join on a not-yet-migrated FK column (eg. a legacy Mongo
    string id) against a table that has already been migrated to Postgres.

    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: a scalar subquery yielding the matching integer id

    """
    return (
        select(model.id)
        .where(compose_legacy_id_single_expression(model, id_))
        .scalar_subquery()
    )


async def resolve_legacy_id(
    session: AsyncSession,
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> int | None:
    """Resolve a legacy (str) or modern (int) resource id to the integer ``id`` of the
    matching row in ``model``.

    :param session: an active Postgres session
    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: the matching integer id, or ``None`` if no row matches

    """
    return (
        await session.execute(
            select(model.id).where(compose_legacy_id_single_expression(model, id_)),
        )
    ).scalar_one_or_none()
