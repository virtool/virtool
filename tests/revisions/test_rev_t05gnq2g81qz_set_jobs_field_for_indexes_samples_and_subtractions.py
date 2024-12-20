import pytest

from assets.revisions.rev_t05gnq2g81qz_set_jobs_field_for_indexes_samples_and_subtractions import (
    upgrade,
)


@pytest.mark.parametrize("collection", ["indexes", "samples", "subtractions"])
async def test_upgrade(ctx, collection, snapshot):
    await ctx.mongo[collection].insert_many(
        [
            {"_id": f"{collection}_1", "name": f"{collection}_1", "job": None},
            {"_id": f"{collection}_2", "name": f"{collection}_2", "job": ["job_id"]},
            {
                "_id": f"{collection}_3",
                "name": f"{collection}_3",
            },
        ],
    )

    assert await ctx.mongo[collection].find().to_list(None) == snapshot

    await upgrade(ctx)

    assert await ctx.mongo[collection].find().to_list(None) == snapshot
