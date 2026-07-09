from pytest_mock import MockerFixture

from virtool.blast.data import BLASTData
from virtool.blast.task import BLASTSweepTask
from virtool.data.layer import DataLayer
from virtool.utils import get_temp_dir


async def test_task_sweeps(mocker: MockerFixture):
    """The task is a thin wrapper that hands off to the data layer."""
    data_layer = mocker.Mock(spec=DataLayer)
    data_layer.blast = mocker.Mock(spec=BLASTData)
    data_layer.blast.sweep = mocker.AsyncMock()

    task = BLASTSweepTask(1, data_layer, {}, get_temp_dir())

    await task.sweep()

    data_layer.blast.sweep.assert_called_once_with()
