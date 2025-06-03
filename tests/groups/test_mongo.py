from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.fake.next import DataFaker
from virtool.groups.mongo import update_member_users_and_api_keys
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field


async def test_update_member_users_and_api_keys(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
):
    group_1 = await fake.groups.create()
    group_2 = await fake.groups.create()

    user = await fake.users.create(groups=[group_1, group_2])

    async with AsyncSession(pg) as session:
        await session.execute(delete(SQLGroup).where(SQLGroup.id == group_2.id))
        await session.commit()

    async with AsyncSession(pg) as pg_session, mongo.create_session() as mongo_session:
        await update_member_users_and_api_keys(
            mongo,
            mongo_session,
            pg_session,
            group_2.id,
        )

    assert await get_one_field(mongo.users, "groups", user.id) == [group_1.id]
