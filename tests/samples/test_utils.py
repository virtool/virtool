from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.samples.utils import check_labels


async def test_check_labels(fake2, spawn_client, pg: AsyncEngine):
    label_1 = await fake2.labels.create()
    label_2 = await fake2.labels.create()

    assert await check_labels(pg, [label_1.id, label_2.id]) == []
    assert await check_labels(pg, [label_2.id, 14]) == [14]
    assert await check_labels(pg, [22, 44]) == [22, 44]
