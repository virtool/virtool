"""
Add space field

Revision ID: s607ucxpct81
Date: 2023-02-08 00:06:52.287448

"""
import asyncio

import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Revision identifiers.
name = "Add space field"
created_at = arrow.get("2023-02-08 00:06:52.287448")
revision_id = "s607ucxpct81"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    for collection in (
        motor_db.analyses,
        motor_db.jobs,
        motor_db.references,
        motor_db.samples,
        motor_db.subtractions,
    ):
        await collection.update_many(
            {"space": {"$exists": False}}, {"$set": {"space": 0}}, session=session
        )


async def test_upgrade(mongo, snapshot):
    collections = (
        mongo.analyses,
        mongo.jobs,
        mongo.references,
        mongo.samples,
        mongo.subtractions,
    )

    for collection in collections:
        await collection.insert_many(
            [
                {
                    "_id": "foo",
                    "space": {"id": 2},
                },
                {
                    "_id": "bar",
                },
                {
                    "_id": "baz",
                    "space": {"id": 15},
                },
                {
                    "_id": "noo",
                },
            ]
        )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert (
        await asyncio.gather(
            *[collection.find().to_list(None) for collection in collections]
        )
        == snapshot
    )
