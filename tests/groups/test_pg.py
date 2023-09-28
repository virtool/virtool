from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.fake.next import DataFaker
from virtool.groups.pg import merge_group_permissions


async def test_merge_group_permissions(fake2: DataFaker, pg: AsyncEngine):
    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create()

    merge_group_permissions(groups=[])
