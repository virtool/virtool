import asyncio

from assets.revisions.rev_l20h8fsbbb28_create_all_database_indexes import upgrade
from virtool.migration import MigrationContext


async def test_upgrade(ctx: MigrationContext, snapshot):
    await upgrade(ctx)

    assert (
        await asyncio.gather(
            ctx.mongo.analyses.index_information(),
            ctx.mongo.groups.index_information(),
            ctx.mongo.history.index_information(),
            ctx.mongo.indexes.index_information(),
            ctx.mongo.keys.index_information(),
            ctx.mongo.otus.index_information(),
            ctx.mongo.samples.index_information(),
            ctx.mongo.sequences.index_information(),
            ctx.mongo.users.index_information(),
        )
        == snapshot
    )
