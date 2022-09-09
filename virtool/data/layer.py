from dataclasses import dataclass

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.groups.data import GroupsData
from virtool.history.data import HistoryData
from virtool.hmm.data import HmmData
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.otus.data import OTUData
from virtool.samples.data import SamplesData
from virtool.uploads.data import UploadsData
from virtool.users.data import UsersData
from virtool.settings.data import SettingsData
from virtool.subtractions.data import SubtractionsData


@dataclass
class DataLayer:

    """
    Provides access to Virtool application data through an abstract interface over
    database and storage.

    """

    analyses: AnalysisData
    blast: BLASTData
    groups: GroupsData
    settings: SettingsData
    history: HistoryData
    hmms: HmmData
    labels: LabelsData
    jobs: JobsData
    otus: OTUData
    samples: SamplesData
    subtractions: SubtractionsData
    uploads: UploadsData
    users: UsersData

    def __post_init__(self):
        self.hmms.bind_layer(self)
        self.samples.bind_layer(self)
        self.subtractions.bind_layer(self)
        self.analyses.bind_layer(self)
