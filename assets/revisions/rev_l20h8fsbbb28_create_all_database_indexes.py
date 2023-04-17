"""
Create all database indexes

Revision ID: l20h8fsbbb28
Date: 2023-01-31 00:56:11.597898

"""
import asyncio

import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel

# Revision identifiers.
name = "Create all database indexes"
created_at = arrow.get("2023-01-31 00:56:11.597898")
revision_id = "l20h8fsbbb28"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    """
    Create all database indexes.

    This was formerly done on application startup. It did not make sense to do this
    everytime the application started when new indexes are rarely introduced.
    """
    await motor_db.analyses.create_indexes(
        [
            IndexModel([("sample.id", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ],
    )

    await motor_db.groups.create_index(
        "name",
        unique=True,
        sparse=True,
    )

    await motor_db.history.create_indexes(
        [
            IndexModel([("otu.id", ASCENDING)]),
            IndexModel([("index.id", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)]),
            IndexModel([("otu.name", ASCENDING)]),
            IndexModel([("otu.version", DESCENDING)]),
        ],
    )

    await motor_db.indexes.create_index(
        [("version", ASCENDING), ("reference.id", ASCENDING)],
        unique=True,
    )

    await motor_db.keys.create_indexes(
        [
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("user.id", ASCENDING)]),
        ],
    )

    await motor_db.otus.create_indexes(
        [
            IndexModel([("_id", ASCENDING), ("isolate.id", ASCENDING)]),
            IndexModel([("name", ASCENDING)]),
            IndexModel([("nickname", ASCENDING)]),
            IndexModel([("abbreviation", ASCENDING)]),
            IndexModel([("reference.id", ASCENDING), ("remote.id", ASCENDING)]),
        ],
    )

    await motor_db.samples.create_index([("created_at", DESCENDING)])

    await motor_db.sequences.create_indexes(
        [
            IndexModel([("otu_id", ASCENDING)]),
            IndexModel([("name", ASCENDING)]),
            IndexModel([("reference.id", ASCENDING), ("remote.id", ASCENDING)]),
        ],
    )

    await motor_db.users.create_indexes(
        [
            IndexModel([("b2c_oid", ASCENDING)], unique=True, sparse=True),
            IndexModel([("handle", ASCENDING)], unique=True, sparse=True),
        ],
    )


async def test_upgrade(mongo, snapshot):
    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert (
        await asyncio.gather(
            mongo.analyses.index_information(),
            mongo.groups.index_information(),
            mongo.history.index_information(),
            mongo.indexes.index_information(),
            mongo.keys.index_information(),
            mongo.otus.index_information(),
            mongo.samples.index_information(),
            mongo.sequences.index_information(),
            mongo.users.index_information(),
        )
        == snapshot
    )
