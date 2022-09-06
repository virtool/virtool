import pytest
from aiohttp import ClientSession
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.data.layer import DataLayer
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmData
from virtool.settings.data import SettingsData
from virtool.jobs.client import DummyJobsClient
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.otus.data import OTUData
from virtool.samples.data import SamplesData
from virtool.subtractions.data import SubtractionsData
from virtool.tasks.client import TasksClient
from virtool.users.data import UsersData


@pytest.fixture
def data_layer(dbi, config, mocker, pg: AsyncEngine, tasks: TasksClient):
    base_url = "https://virtool.example.com"

    return DataLayer(
        AnalysisData(dbi, config, pg, tasks),
        mocker.Mock(spec=BLASTData),
        GroupsData(dbi),
        SettingsData(dbi),
        HistoryData(config.data_path, dbi),
        HmmData(mocker.Mock(spec=ClientSession), config, dbi, tasks),
        LabelsData(dbi, pg),
        JobsData(DummyJobsClient(), dbi, pg),
        OTUData({"db": dbi, "pg": pg}),
        SamplesData(config, dbi, pg),
        SubtractionsData(base_url, config, dbi, pg),
        UsersData(dbi, pg),
    )
