from __future__ import annotations

from typing import TYPE_CHECKING

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.auth.client import AuthorizationClient
from virtool.auth.data import AuthData
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
from virtool.tasks.data import TasksData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData
from virtool.users.sessions import SessionData

if TYPE_CHECKING:
    from virtool.mongo.core import DB


def create_data_layer(
    db: "DB",
    pg: AsyncEngine,
    config: Config,
    client,
    redis: Redis,
    auth: AuthorizationClient,
) -> DataLayer:
    """
    Create and return a data layer object.

    :param db: the mongoDB object
    :param pg: the postgress object
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param redis: the redis object
    :param auth: the authorization client object
    :return: the application data layer
    """
    data_layer = DataLayer(
        AccountData(db, redis),
        AnalysisData(db, config, pg),
        AuthData(auth, pg, db),
        BLASTData(client, db, pg),
        GroupsData(db),
        HistoryData(config.data_path, db),
        HmmData(client, config, db, pg),
        IndexData(db, config, pg),
        JobsData(JobsClient(redis), db, pg),
        LabelsData(db, pg),
        MessagesData(pg, db),
        OTUData(db, config.data_path),
        ReferencesData(db, pg, config, client),
        SamplesData(config, db, pg),
        SubtractionsData(config.base_url, config, db, pg),
        SessionData(redis),
        SettingsData(db),
        TasksData(pg, redis),
        UploadsData(config, db, pg),
        UsersData(db, pg),
    )

    return data_layer
