from datetime import timedelta

import pytest

from assets.revisions.rev_zma2wj6b39hs_deduplicate_sample_names import upgrade
from virtool.migration import MigrationContext


@pytest.mark.parametrize("spaces", [True, False])
async def test_upgrade(
    ctx: MigrationContext,
    snapshot,
    static_time,
    spaces,
):
    samples = [
        {
            "_id": "test_id",
            "name": "test_name",
            "created_at": static_time.datetime,
            "space_id": "0",
        },
        {
            "_id": "test_id_2",
            "name": "test_name (2)",
            "created_at": static_time.datetime + timedelta(days=3),
            "space_id": "0",
        },
        {
            "_id": "test_id_3",
            "name": "test_name",
            "created_at": static_time.datetime + timedelta(days=2),
            "space_id": "0",
        },
        {
            "_id": "test_id_4",
            "name": "test_name",
            "created_at": static_time.datetime + timedelta(days=1),
            "space_id": "1",
        },
    ]

    if not spaces:
        for sample in samples:
            sample.pop("space_id")

    await ctx.mongo.samples.insert_many(samples)

    await upgrade(ctx)

    assert await ctx.mongo.samples.find().to_list(None) == snapshot
