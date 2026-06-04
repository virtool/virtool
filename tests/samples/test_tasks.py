import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.samples.tasks import (
    SampleWorkflowsUpdateTask,
)
from virtool.tasks.sql import SQLTask
from virtool.utils import get_temp_dir, timestamp


@pytest.mark.parametrize("ready", [True, False])
async def test_update_workflows_fields(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo,
    pg: AsyncEngine,
    ready,
    static_time,
    snapshot,
):
    user = await fake.users.create()

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

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLAnalysis(
                    legacy_id="test",
                    created_at=timestamp(),
                    updated_at=timestamp(),
                    workflow="pathoscope",
                    ready=ready,
                    sample="test_id",
                    reference="ref",
                    index="index",
                    subtractions=[],
                    user_id=user.id,
                ),
                SQLAnalysis(
                    legacy_id="test1",
                    created_at=timestamp(),
                    updated_at=timestamp(),
                    workflow="nuvs",
                    ready=False,
                    sample="test_id",
                    reference="ref",
                    index="index",
                    subtractions=[],
                    user_id=user.id,
                ),
            ],
        )
        await session.commit()

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

    task = SampleWorkflowsUpdateTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert await mongo.samples.find().to_list(None) == snapshot
