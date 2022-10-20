from __future__ import annotations

from typing import TYPE_CHECKING

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.config import Config
from virtool.data.layer import DataLayer
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmData
from virtool.indexes.data import IndexData
from virtool.jobs.client import JobsClient
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


if TYPE_CHECKING:
    from virtool.mongo.core import DB


def create_data_layer(
    db: "DB", pg: AsyncEngine, config: Config, client, redis: Redis
) -> DataLayer:
    """
    Create and return a data layer object.

    :param db: the mongoDB object
    :param pg: the postgress object
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param redis: the redis object
    :return: the application data layer
    """
    data_layer = DataLayer(
        AccountData(db, redis),
        AnalysisData(db, config, pg),
        BLASTData(db, pg),
        GroupsData(db),
        SettingsData(db),
        HistoryData(config.data_path, db),
        ReferencesData(db, pg, config, client),
        HmmData(client, config, db, pg),
        IndexData(db, config, pg),
        LabelsData(db, pg),
        JobsData(JobsClient(redis), db, pg),
        OTUData(db, config),
        SamplesData(config, db, pg),
        SubtractionsData(config.base_url, config, db, pg),
        UploadsData(config, db, pg),
        UsersData(db, pg),
        TasksData(pg, redis),
    )

    return data_layer
