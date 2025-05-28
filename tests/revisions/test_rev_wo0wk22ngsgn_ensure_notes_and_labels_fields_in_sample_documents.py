from assets.revisions.rev_wo0wk22ngsgn_ensure_notes_and_labels_fields_in_sample_documents import (
    upgrade,
)


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.samples.insert_many(
        [
            {
                "_id": "sample_1",
                "labels": [1, 2],
                "name": "has_both",
                "notes": "existing notes",
            },
            {"_id": "sample_2", "labels": [3, 4], "name": "has_labels"},
            {"_id": "sample_3", "name": "has_notes", "notes": "only has notes"},
            {"_id": "sample_4", "name": "has_neither"},
        ],
    )

    assert [sample async for sample in ctx.mongo.samples.find({})] == snapshot(
        name="before",
    )

    await upgrade(ctx)

    assert [sample async for sample in ctx.mongo.samples.find({})] == snapshot(
        name="after",
    )
