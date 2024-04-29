from dataclasses import dataclass

from aioredis import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.administrators.data import AdministratorsData
from virtool.analyses.data import AnalysisData
from virtool.authorization.client import AuthorizationClient
from virtool.blast.data import BLASTData
from virtool.config import Config
from virtool.data.http import HTTPClient
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmsData
from virtool.indexes.data import IndexData
from virtool.jobs.client import JobsClient
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.messages.data import MessagesData
from virtool.ml.data import MLData
from virtool.mongo.core import Mongo
from virtool.otus.data import OTUData
from virtool.references.data import ReferencesData
from virtool.samples.data import SamplesData
from virtool.settings.data import SettingsData
from virtool.spaces.data import SpacesData
from virtool.subtractions.data import SubtractionsData
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData
from virtool.users.sessions import SessionData


@dataclass
class DataLayer:
    """Provides access to Virtool application data through an abstract interface over
    database and storage.

    """

    account: AccountData
    administrators: AdministratorsData
    analyses: AnalysisData
    blast: BLASTData
    groups: GroupsData
    history: HistoryData
    hmms: HmmsData
    index: IndexData
    jobs: JobsData
    labels: LabelsData
    messages: MessagesData
    ml: "MLData"
    otus: OTUData
    references: ReferencesData
    samples: SamplesData
    subtractions: SubtractionsData
    sessions: SessionData
    settings: SettingsData
    spaces: SpacesData
    tasks: TasksData
    uploads: UploadsData
    users: UsersData

    def __post_init__(self):
        self.hmms.bind_layer(self)
        self.samples.bind_layer(self)
        self.subtractions.bind_layer(self)
        self.blast.bind_layer(self)
        self.analyses.bind_layer(self)
        self.references.bind_layer(self)
        self.sessions.bind_layer(self)
        self.account.bind_layer(self)
        self.administrators.bind_layer(self)
        self.ml.bind_layer(self)


def create_data_layer(
    authorization_client: AuthorizationClient,
    mongo: "Mongo",
    pg: AsyncEngine,
    config: Config,
    client,
    redis: Redis,
) -> DataLayer:
    """Create and return a data layer object.

    :param authorization_client: the authorization client
    :param mongo: the MongoDB client
    :param pg: the Postgres client
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param redis: the redis object
    :return: the application data layer
    """
    jobs_client = JobsClient(redis)

    data_layer = DataLayer(
        AccountData(authorization_client, mongo, pg, redis),
        AdministratorsData(authorization_client, mongo, pg),
        AnalysisData(mongo, config, pg),
        BLASTData(client, mongo, pg),
        GroupsData(authorization_client, mongo, pg),
        HistoryData(config.data_path, mongo),
        HmmsData(client, config, mongo, pg),
        IndexData(mongo, config, pg),
        JobsData(jobs_client, mongo, pg),
        LabelsData(mongo, pg),
        MessagesData(pg, mongo),
        MLData(config, HTTPClient(client), pg),
        OTUData(mongo, config.data_path),
        ReferencesData(mongo, pg, config, client),
        SamplesData(config, mongo, pg, jobs_client),
        SubtractionsData(config.base_url, config, mongo, pg),
        SessionData(redis),
        SettingsData(mongo),
        SpacesData(authorization_client, mongo, pg),
        TasksData(pg, TasksClient(redis)),
        UploadsData(config, mongo, pg),
        UsersData(authorization_client, mongo, pg),
    )

    return data_layer
