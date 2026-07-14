from assets.revisions.rev_b4st1kx9mj2q_backfill_null_index_tasks import upgrade
from virtool.migration.ctx import MigrationContext


async def test_upgrade(ctx: MigrationContext):
    await ctx.mongo.indexes.insert_many(
        [
            {"_id": "missing_task", "job": {"id": 1}},
            {"_id": "null_task", "job": {"id": 2}, "task": None},
            {"_id": "task_backed", "task": {"id": 3}},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.indexes.find_one("missing_task", ["task"]) == {
        "_id": "missing_task",
        "task": None,
    }
    assert await ctx.mongo.indexes.find_one("null_task", ["task"]) == {
        "_id": "null_task",
        "task": None,
    }
    assert await ctx.mongo.indexes.find_one("task_backed", ["task"]) == {
        "_id": "task_backed",
        "task": {"id": 3},
    }
