from assets.revisions.rev_io3dep44jtym_set_deleted_field_for_subtraction_documents import (
    upgrade,
)
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.subtraction.insert_many(
        [
            {
                "_id": "subtraction_1",
                "file": {"id": "file.fa", "name": "file.fa"},
                "gc": {"a": 10, "c": 40, "g": 40, "t": 10, "n": 0},
                "is_host": True,
                "name": "subtraction_1",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_1"},
                "deleted": True,
            },
            {
                "_id": "subtraction_2",
                "file": {"id": "file_2.fa", "name": "file_2.fa"},
                "gc": {"a": 10, "c": 35, "g": 30, "t": 10, "n": 15},
                "is_host": True,
                "name": "subtraction_2",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_2"},
            },
            {
                "_id": "subtraction_3",
                "file": {"id": "file_3.fa", "name": "file_3.fa"},
                "gc": {"a": 10, "c": 35, "g": 30, "t": 10, "n": 15},
                "is_host": True,
                "name": "subtraction_3",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_3"},
                "deleted": False,
            },
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.subtraction.find().to_list(None) == snapshot
