"""A fixture and class for representing the analysis associated with a workflow run."""

from pathlib import Path
from typing import Any

from pyfixtures import fixture

from virtool.analyses.models import Analysis, AnalysisSample
from virtool.indexes.models import IndexNested
from virtool.jobs.models import JobNested
from virtool.ml.models import MLModelRelease
from virtool.references.models import ReferenceNested
from virtool.subtractions.models import SubtractionNested
from virtool.workflow.api.client import APIClient
from virtool.workflow.files import VirtoolFileFormat


class WFAnalysis:
    """The Virtool analysis being populated by the running workflow."""

    def __init__(
        self,
        api: APIClient,
        analysis_id: str,
        index: IndexNested,
        ml: MLModelRelease | None,
        reference: ReferenceNested,
        sample: AnalysisSample,
        subtractions: list[SubtractionNested],
        workflow: str,
    ) -> None:
        self._api = api

        self.id = analysis_id
        """The unique ID for the analysis."""

        self.index = index
        """The index being used for the analysis."""

        self.ml = ml
        """The ML model release being used for the analysis."""

        self.reference = reference
        """The reference being used for the analysis."""

        self.sample = sample
        """The parent sample for the analysis."""

        self.subtractions = subtractions
        """The subtractions being used for the analysis."""

        self.workflow = workflow
        """The workflow being run to populate the analysis."""

    async def delete(self) -> None:
        """Delete the analysis.

        This method should be called if the workflow fails before a result is uploaded.
        """
        await self._api.delete(f"/analyses/{self.id}")

    async def upload_file(self, path: Path, fmt: VirtoolFileFormat = "unknown") -> None:
        """Upload files that should be associated with the current analysis.

        :param path: the path to the file to upload
        :param fmt: the file format
        """
        await self._api.post_file(
            f"/analyses/{self.id}/files",
            path,
            fmt,
        )

    async def upload_result(self, results: dict[str, Any]) -> None:
        """Upload the results dict for the analysis.

        :param results: the analysis results
        """
        await self._api.patch_json(f"/analyses/{self.id}", {"results": results})


@fixture
async def analysis(
    _api: APIClient,
    job: JobNested,
) -> WFAnalysis:
    """The analysis associated with the running workflow."""
    id_ = job.args["analysis_id"]

    analysis_dict = await _api.get_json(f"/analyses/{id_}")
    analysis = Analysis(**analysis_dict)

    return WFAnalysis(
        api=_api,
        analysis_id=id_,
        index=analysis.index,
        ml=analysis.ml,
        reference=analysis.reference,
        sample=analysis.sample,
        subtractions=analysis.subtractions,
        workflow=job.workflow,
    )
