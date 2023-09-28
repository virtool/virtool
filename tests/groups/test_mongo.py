from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.fake.next import DataFaker
from virtool.groups.mongo import update_member_users_and_api_keys
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field


async def test_update_member_users_and_api_keys(
    fake2: DataFaker, mongo: Mongo, pg: AsyncEngine
):
    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create()

    user = await fake2.users.create(groups=[group_1, group_2])

    await mongo.groups.delete_one({"_id": group_2.id})

    async with AsyncSession(pg) as pg_session:
        async with mongo.create_session() as mongo_session:
            await update_member_users_and_api_keys(
                mongo, mongo_session, pg_session, group_2.id
            )

    assert await get_one_field(mongo.groups, "groups", user.id) == [group_1.id]
