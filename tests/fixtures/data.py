import pytest
from aiohttp import ClientSession
from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.data.layer import DataLayer
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmData
from virtool.jobs.client import DummyJobsClient
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.otus.data import OTUData
from virtool.references.data import ReferencesData
from virtool.samples.data import SamplesData
from virtool.settings.data import SettingsData
from virtool.subtractions.data import SubtractionsData
from virtool.tasks.data import TasksData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData


@pytest.fixture
def data_layer(dbi, config, mocker, pg: AsyncEngine, redis: Redis):
    base_url = "https://virtool.example.com"
    return DataLayer(
        AccountData(dbi, redis),
        AnalysisData(dbi, config, pg),
        BLASTData(mocker.Mock(spec=ClientSession), dbi, pg),
        GroupsData(dbi),
        SettingsData(dbi),
        HistoryData(config.data_path, dbi),
        ReferencesData(dbi, pg, config, mocker.Mock(spec=ClientSession)),
        HmmData(mocker.Mock(spec=ClientSession), config, dbi, pg),
        LabelsData(dbi, pg),
        JobsData(DummyJobsClient(), dbi, pg),
        OTUData({"db": dbi, "pg": pg}),
        SamplesData(config, dbi, pg),
        SubtractionsData(base_url, config, dbi, pg),
        UploadsData(config, dbi, pg),
        UsersData(dbi, pg),
        TasksData(pg, redis),
    )
