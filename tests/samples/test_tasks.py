import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.samples.tasks import (
    UpdateSampleWorkflowsTask,
)
from virtool.tasks.models import SQLTask
from virtool.utils import get_temp_dir


@pytest.mark.parametrize("ready", [True, False])
async def test_update_workflows_fields(
    data_layer: DataLayer,
    mongo,
    pg: AsyncEngine,
    ready,
    static_time,
    snapshot,
):
    await mongo.samples.insert_one(
        {
            "_id": "test_id",
            "library_type": "normal",
            "nuvs": False,
            "pathoscope": True,
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "none",
                "pathoscope": "none",
            },
        },
        session=None,
    )

    await mongo.analyses.insert_many(
        [
            {
                "_id": "test",
                "sample": {"id": "test_id"},
                "ready": ready,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "test1",
                "sample": {"id": "test_id"},
                "ready": False,
                "workflow": "nuvs",
            },
        ],
        session=None,
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="populate_workflows_field",
                type="populate_workflows_field",
                created_at=static_time.datetime,
            ),
        )
        await session.commit()

    task = UpdateSampleWorkflowsTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert await mongo.samples.find().to_list(None) == snapshot
