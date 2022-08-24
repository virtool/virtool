import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.data.layer import DataLayer
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.jobs.client import DummyJobsClient
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.otus.data import OTUData
from virtool.samples.data import SamplesData
from virtool.users.data import UsersData


@pytest.fixture
def data_layer(dbi, config, mocker, pg: AsyncEngine):
    return DataLayer(
        AnalysisData({"db": dbi, "pg": pg}),
        mocker.Mock(spec=BLASTData),
        GroupsData(dbi),
        HistoryData(config.data_path, dbi),
        LabelsData(dbi, pg),
        JobsData(DummyJobsClient(), dbi, pg),
        OTUData({"db": dbi, "pg": pg}),
        SamplesData(config, dbi, pg),
        UsersData(dbi, pg),
    )
