import datetime

from syrupy.matchers import path_type

from assets.revisions.rev_oxu8ghlvuqmh_update_subtraction_nicknames_created_at_and_file_names import (
    upgrade,
)
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.subtraction.insert_many(
        [
            {
                "_id": "complete",
                "created_at": datetime.datetime.now(),
                "nickname": "complete_nickname",
                "file": {"name": "complete_file_name", "id": "complete_file_id"},
            },
            {
                "_id": "legacy",
                "file": {"id": "legacy_file_id", "name": None},
            },
            {
                "_id": "deleted_legacy",
                "file": {"id": "legacy_file_id", "name": None},
                "deleted": True,
            },
        ],
    )

    subtraction_path = ctx.data_path / "subtractions" / "legacy"
    subtraction_path.mkdir(exist_ok=True, parents=True)
    index_file_path = subtraction_path / "subtraction.1.bt2"
    index_file_path.write_text("subtraction_index")

    await upgrade(ctx)

    assert await ctx.mongo.subtraction.find({}).to_list() == snapshot(
        matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True),
    )
