"""copy api keys to postgres

Revision ID: 31su1xw351h2
Date: 2026-05-29 21:40:41.278957

"""

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.account.sql import SQLAPIKey
from virtool.data.topg import resolve_user_id
from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "copy api keys to postgres"
created_at = arrow.get("2026-05-29 21:40:41.278957")
revision_id = "31su1xw351h2"

alembic_down_revision = "12c20b71cffc"
virtool_down_revision = None

# The api_keys table must exist before backfilling.
required_alembic_revision = "12c20b71cffc"


async def upgrade(ctx: MigrationContext) -> None:
    """Copy legacy MongoDB API keys into the PostgreSQL ``api_keys`` table.

    For each Mongo key document a matching ``SQLAPIKey`` row is created and the
    Mongo document's ``id`` is rewritten from its legacy string value to the
    integer primary key assigned by PostgreSQL. The Mongo ``_id`` (hashed secret)
    stays the cross-store handle, so the migration is idempotent: keys that
    already have a PostgreSQL row are skipped, leaving their integer ``id``
    untouched.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_hashes = set(
            (await session.execute(select(SQLAPIKey.hashed))).scalars(),
        )

        copied = 0

        async for document in ctx.mongo.keys.find():
            if document["_id"] in existing_hashes:
                continue

            sql_key = SQLAPIKey(
                hashed=document["_id"],
                name=document["name"],
                created_at=arrow.get(document["created_at"]).naive,
                user_id=await resolve_user_id(session, document["user"]["id"]),
                permissions=document["permissions"],
            )

            session.add(sql_key)
            await session.flush()

            await ctx.mongo.keys.update_one(
                {"_id": document["_id"]},
                {"$set": {"id": sql_key.id}},
            )

            copied += 1

        await session.commit()

    logger.info("backfilled api keys from mongodb", count=copied)
