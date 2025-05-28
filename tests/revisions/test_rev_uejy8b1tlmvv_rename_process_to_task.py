from assets.revisions.rev_uejy8b1tlmvv_rename_process_to_task import upgrade


async def test_upgrade(ctx, snapshot):
    await ctx.mongo.references.insert_many(
        [
            {"_id": "ref_needs_migration", "process": {"id": "process_id"}},
            {"_id": "ref_no_proccess"},
            {"_id": "ref_already migrated", "task": {"id": "task_id"}},
        ],
    )

    await ctx.mongo.status.insert_many(
        [
            {"_id": "hmm", "process": {"id": "process_id"}},
            {"_id": "no_upgrade", "process": {"id": "process_id"}},
        ],
    )

    assert [reference async for reference in ctx.mongo.references.find()] == snapshot

    await upgrade(ctx)

    assert [reference async for reference in ctx.mongo.references.find()] == snapshot

    assert [status async for status in ctx.mongo.status.find()] == snapshot
