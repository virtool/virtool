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
from virtool.indexes.data import IndexData
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
def data_layer(mongo, config, mocker, pg: AsyncEngine, redis: Redis):
    base_url = "https://virtool.example.com"
    return DataLayer(
        AccountData(mongo, redis),
        AnalysisData(mongo, config, pg),
        BLASTData(mocker.Mock(spec=ClientSession), dbi, pg),
        mocker.Mock(spec=BLASTData),
        GroupsData(mongo),
        SettingsData(mongo),
        HistoryData(config.data_path, mongo),
        ReferencesData(mongo, pg, config, mocker.Mock(spec=ClientSession)),
        HmmData(mocker.Mock(spec=ClientSession), config, mongo, pg),
        IndexData(mongo, config, pg),
        LabelsData(mongo, pg),
        JobsData(DummyJobsClient(), mongo, pg),
        OTUData({"db": mongo, "pg": pg}),
        SamplesData(config, mongo, pg),
        SubtractionsData(base_url, config, mongo, pg),
        UploadsData(config, mongo, pg),
        UsersData(mongo, pg),
        TasksData(pg, redis),
    )
