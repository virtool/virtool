from dataclasses import dataclass

from aiohttp import ClientSession
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.caches.data import CachesData
from virtool.config import Config
from virtool.groups.data import GroupsData
from virtool.health.data import HealthData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmsData
from virtool.identifier import AbstractIdProvider
from virtool.indexes.data import IndexData
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
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
    caches: CachesData
    groups: GroupsData
    health: HealthData
    history: HistoryData
    hmms: HmmsData
    index: IndexData
    jobs: JobsData
    labels: LabelsData
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


def create_data_layer(
    pg: AsyncEngine,
    config: Config,
    client: ClientSession,
    storage: StorageBackend,
    id_provider: AbstractIdProvider,
) -> DataLayer:
    """Create and return a data layer object.

    :param pg: the Postgres client
    :param config: the application config object
    :param client: an async HTTP client session for the server
    :param storage: the storage backend for file operations
    :param id_provider: the provider of legacy string ids for new resources
    :return: the application data layer
    """
    return DataLayer(
        AccountData(pg),
        AnalysisData(pg, storage),
        BLASTData(client, pg),
        CachesData(pg, storage, config.cache_storage_budget),
        GroupsData(pg),
        HealthData(pg),
        HistoryData(pg),
        HmmsData(client, pg, storage),
        IndexData(config, pg, storage),
        JobsData(pg),
        LabelsData(pg),
        OTUData(pg, id_provider),
        ReferencesData(pg, config, client, storage),
        SamplesData(config, pg, storage),
        SubtractionsData(config.base_url, pg, storage),
        SessionData(pg),
        SettingsData(pg),
        TasksData(pg),
        UploadsData(pg, storage),
        UsersData(pg),
    )
