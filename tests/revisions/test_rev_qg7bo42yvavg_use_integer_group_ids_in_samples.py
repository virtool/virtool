from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_qg7bo42yvavg_use_integer_group_ids_in_samples import upgrade
from virtool.groups.pg import SQLGroup
from virtool.migration import MigrationContext


async def test_upgrade(
    ctx: MigrationContext,
    no_permissions: dict[str, bool],
    snapshot,
):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLGroup.metadata.create_all)
        await conn.commit()

    async with AsyncSession(ctx.pg) as session:
        session.add_all(
            [
                SQLGroup(
                    id=1,
                    name="Group 1",
                    legacy_id="group_1",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    id=2,
                    name="Group 2",
                    legacy_id="group_2",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    id=3,
                    name="Group 3",
                    legacy_id="group_3",
                    permissions=no_permissions,
                ),
            ],
        )

        await session.commit()

    await ctx.mongo.samples.insert_many(
        [
            {"_id": "sample_1", "group": 3},
            {"_id": "sample_2", "group": "group_2"},
            {"_id": "sample_3", "group": 1},
            # Should have group `None` since it was "none" before.
            {"_id": "sample_4", "group": "none"},
            # # Should have group `None` since it was `None` before.
            {"_id": "sample_5", "group": None},
            # Should have group `None` since it was "" before.
            {"_id": "sample_6", "group": ""},
            # Should have `None` group since the old id was not in the lookup.
            {"_id": "sample_7", "group": "group_10"},
        ],
    )

    await upgrade(ctx)

    assert await ctx.mongo.samples.find({}).to_list(None) == snapshot(name="mongo")
