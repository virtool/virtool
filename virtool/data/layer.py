from dataclasses import dataclass

from virtool.analyses.data import AnalysisData
from virtool.blast.data import BLASTData


@dataclass
class DataLayer:

    """
    Provides access to Virtool application data through an abstract interface over
    database and storage.

    """

    analyses: AnalysisData
    blast: BLASTData
