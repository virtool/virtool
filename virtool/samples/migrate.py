import asyncio

import virtool.db.migrate
import virtool.db.utils
import virtool.samples.db
import virtool.utils


async def migrate_samples(app):
    db = app["db"]

    await recalculate_all_workflow_tags(db)
    await virtool.db.utils.delete_unready(db.samples)


async def recalculate_all_workflow_tags(db):
    sample_ids = await db.samples.distinct("_id")

    for chunk in virtool.utils.chunk_list(sample_ids, 50):
        coros = [virtool.samples.db.recalculate_workflow_tags(db, sample_id) for sample_id in chunk]
        await asyncio.gather(*coros)
