from __future__ import annotations

from typing import TYPE_CHECKING

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.administrators.data import AdministratorsData
from virtool.analyses.data import AnalysisData
from virtool.authorization.client import AuthorizationClient
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
from virtool.messages.data import MessagesData
from virtool.otus.data import OTUData
from virtool.references.data import ReferencesData
from virtool.samples.data import SamplesData
from virtool.settings.data import SettingsData
from virtool.subtractions.data import SubtractionsData
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData
from virtool.users.sessions import SessionData

if TYPE_CHECKING:
    from virtool.mongo.core import DB


def create_data_layer(
    authorization_client: AuthorizationClient,
    mongo: "DB",
    pg: AsyncEngine,
    config: Config,
    client,
    redis: Redis,
) -> DataLayer:
    """
    Create and return a data layer object.

    :param authorization_client: the authorization client
    :param mongo: the MongoDB client
    :param pg: the Postgres client
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param redis: the redis object
    :return: the application data layer
    """
    data_layer = DataLayer(
        AccountData(mongo, redis),
        AdministratorsData(authorization_client, mongo),
        AnalysisData(mongo, config, pg),
        BLASTData(client, mongo, pg),
        GroupsData(authorization_client, mongo),
        HistoryData(config.data_path, mongo),
        HmmData(client, config, mongo, pg),
        IndexData(mongo, config, pg),
        JobsData(JobsClient(redis), mongo, pg),
        LabelsData(mongo, pg),
        MessagesData(pg, mongo),
        OTUData(mongo, config.data_path),
        ReferencesData(mongo, pg, config, client),
        SamplesData(config, mongo, pg),
        SubtractionsData(config.base_url, config, mongo, pg),
        SessionData(redis),
        SettingsData(mongo),
        TasksData(pg, TasksClient(redis)),
        UploadsData(config, mongo, pg),
        UsersData(authorization_client, mongo, pg),
    )

    return data_layer
