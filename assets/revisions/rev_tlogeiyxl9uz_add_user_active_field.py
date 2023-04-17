"""
Add user active field

Revision ID: tlogeiyxl9uz
Date: 2022-09-29 21:56:37.130137

"""
import arrow
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Revision identifiers.
name = "Add user active field"
created_at = arrow.get("2022-09-29 21:56:37.130137")
revision_id = "tlogeiyxl9uz"
required_alembic_revision = None


async def upgrade(motor_db: AsyncIOMotorDatabase, session: AsyncIOMotorClientSession):
    """
    Set the ``active`` field to ``True`` for users that do not have the field.

    This means all users will be active. The application can set the field to ``False``
    in order to deactivate the user account.

    """
    await motor_db.users.update_many(
        {"active": {"$exists": False}}, {"$set": {"active": True}}, session=session
    )


async def test_upgrade(mongo, snapshot):
    await mongo.users.insert_many(
        [
            {
                "_id": "bob",
                "active": False,
            },
            {
                "_id": "dave",
                "active": True,
            },
            {
                "_id": "fran",
            },
            {
                "_id": "mary",
            },
        ]
    )

    async with await mongo.client.start_session() as session:
        async with session.start_transaction():
            await upgrade(mongo, session)

    assert await mongo.users.find().to_list(None) == snapshot
