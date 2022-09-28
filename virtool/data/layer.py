from dataclasses import dataclass

from virtool.account.data import AccountData
from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmData
from virtool.indexes.data import IndexData
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


@dataclass
class DataLayer:

    """
    Provides access to Virtool application data through an abstract interface over
    database and storage.

    """

    account: AccountData
    analyses: AnalysisData
    blast: BLASTData
    groups: GroupsData
    settings: SettingsData
    history: HistoryData
    references: ReferencesData
    hmms: HmmData
    index: IndexData
    labels: LabelsData
    jobs: JobsData
    otus: OTUData
    samples: SamplesData
    subtractions: SubtractionsData
    uploads: UploadsData
    users: UsersData
    tasks: TasksData

    def __post_init__(self):
        self.hmms.bind_layer(self)
        self.samples.bind_layer(self)
        self.subtractions.bind_layer(self)
        self.blast.bind_layer(self)
        self.analyses.bind_layer(self)
        self.references.bind_layer(self)
