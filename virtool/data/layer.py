from dataclasses import dataclass

from aiohttp import ClientSession
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.config import Config
from virtool.data.http import HTTPClient
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmsData
from virtool.indexes.data import IndexData
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.messages.data import MessagesData
from virtool.ml.data import MLData
from virtool.mongo.core import Mongo
from virtool.otus.data import OTUData
from virtool.references.data import ReferencesData
from virtool.samples.data import SamplesData
from virtool.sessions.data import SessionData
from virtool.settings.data import SettingsData
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.data import SubtractionsData
from virtool.tasks.data import TasksData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData


@dataclass
class DataLayer:
    """Provides access to application data."""

    account: AccountData
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
        self.ml.bind_layer(self)


def create_data_layer(
    mongo: "Mongo",
    pg: AsyncEngine,
    config: Config,
    client: ClientSession,
    storage: StorageBackend | None = None,
) -> DataLayer:
    """Create and return a data layer object.

    :param mongo: the MongoDB client
    :param pg: the Postgres client
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param storage: the storage backend for file operations
    :return: the application data layer
    """
    http_client = HTTPClient(client)

    if storage is None:
        from virtool.storage.filesystem import FilesystemProvider

        storage = FilesystemProvider(config.data_path / "storage")

    return DataLayer(
        AccountData(mongo, pg),
        AnalysisData(mongo, pg, storage),
        BLASTData(client, mongo, pg),
        GroupsData(mongo, pg),
        HistoryData(storage, mongo, pg),
        HmmsData(client, mongo, pg, storage),
        IndexData(mongo, config, pg, storage),
        JobsData(mongo, pg),
        LabelsData(mongo, pg),
        MessagesData(pg),
        MLData(http_client, pg, storage),
        OTUData(config.data_path, mongo, pg),
        ReferencesData(mongo, pg, config, client, storage),
        SamplesData(config, mongo, pg),
        SubtractionsData(config.base_url, config, mongo, pg),
        SessionData(pg),
        SettingsData(mongo),
        TasksData(pg),
        UploadsData(config, mongo, pg),
        UsersData(pg),
    )
