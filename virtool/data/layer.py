from dataclasses import dataclass

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData
from virtool.groups.data import GroupsData
from virtool.jobs.data import JobsData
from virtool.labels.data import LabelsData
from virtool.otus.data import OTUData
from virtool.users.data import UsersData


@dataclass
class DataLayer:

    """
    Provides access to Virtool application data through an abstract interface over
    database and storage.

    """

    analyses: AnalysisData
    blast: BLASTData
    groups: GroupsData
    labels: LabelsData
    jobs: JobsData
    otus: OTUData
    users: UsersData
