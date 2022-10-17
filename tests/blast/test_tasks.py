from sqlalchemy.ext.asyncio import AsyncSession

from virtool.blast.models import SQLNuVsBlast
from virtool.blast.task import BLASTTask
from virtool.data.layer import DataLayer
from virtool.tasks.models import Task as SQLTask
from virtool.utils import get_temp_dir


async def test_task(data_layer: DataLayer, mocker, pg, static_time):
    mocker.patch("virtool.blast.data.")

    async with AsyncSession(pg) as session:
        session.add(
            SQLNuVsBlast(
                analysis_id=

            ),
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="write_subtraction_fasta_file",
                type="generate_fasta_file",
                created_at=static_time.datetime,
            )
        )

        await session.commit()

    mocker.patch("virtool.blast.")

    data_layer.blast.create_nuvs_blast()

    task = BLASTTask(1, data_layer, {"subtraction": "foo"}, get_temp_dir())

    await task.run()
