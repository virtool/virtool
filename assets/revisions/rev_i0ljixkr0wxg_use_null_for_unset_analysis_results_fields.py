"""
Use null for unset analysis results fields

Revision ID: i0ljixkr0wxg
Date: 2022-10-03 19:29:47.077288

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Revision identifiers.
name = "Use null for unset analysis results fields"
created_at = arrow.get("2022-10-03 19:29:47.077288")
revision_id = "i0ljixkr0wxg"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    await motor_db.analyses.update_many(
        {"results": {"$exists": False}},
        {"$set": {"results": None}},
        session=session,
    )


async def test_upgrade(mongo: AsyncIOMotorDatabase, snapshot):
    await mongo.analyses.insert_many(
        [
            {
                "_id": "bat",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "workflow": "aodp",
            },
            {
                "_id": "bar",
                "read_count": 7982,
                "results": [9, 8, 7, 6, 5],
                "subtracted_count": 112,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "baz",
                "results": None,
                "workflow": "nuvs",
            },
            {
                "_id": "bad",
                "join_histogram": [1, 2, 3, 4, 5],
                "joined_pair_count": 12345,
                "remainder_pair_count": 54321,
                "workflow": "aodp",
            },
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.analyses.find().to_list(None) == snapshot
