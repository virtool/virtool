import filecmp
from pathlib import Path

import pytest
from pyfixtures import FixtureScope

from virtool.jobs.models import Job
from virtool.uploads.models import UploadMinimal
from virtool.users.models_base import UserNested
from virtool.workflow.data.subtractions import WFNewSubtraction, WFSubtraction
from virtool.workflow.errors import JobsAPIConflictError
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.pytest_plugin.utils import SUBTRACTION_FILENAMES


@pytest.fixture
def _new_subtraction_job(workflow_data: WorkflowData):
    """A job for creating a new subtraction."""
    workflow_data.job.args = {
        "subtraction_id": workflow_data.new_subtraction.id,
    }
    workflow_data.job.workflow = "create_subtraction"

    workflow_data.new_subtraction.upload = UploadMinimal(
        id=3,
        created_at=workflow_data.new_subtraction.created_at,
        name="subtraction.fa.gz",
        name_on_disk="subtraction.fa.gz",
        ready=True,
        removed=False,
        removed_at=None,
        reserved=False,
        size=1000,
        type="subtraction",
        uploaded_at=workflow_data.new_subtraction.created_at,
        user=workflow_data.new_subtraction.user or UserNested(id=1, handle="test"),
    )

    return workflow_data


class TestSubtractions:
    async def test_ok(
        self,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that the subtractions fixture matches the expected data and writes the
        subtraction FASTA to the work path.
        """
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

        subtractions: list[WFSubtraction] = await scope.instantiate_by_key(
            "subtractions",
        )

        assert len(subtractions) == 1

        subtraction = subtractions[0]

        assert filecmp.cmp(
            subtraction.fasta_path,
            example_path
            / "subtractions"
            / "arabidopsis_thaliana"
            / "subtraction.fa.gz",
        )

    async def test_bowtie2_files_not_downloaded(
        self,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that Bowtie2 index files listed on the subtraction are not pulled into
        the work path.

        Subtractions created before the Bowtie2 build was dropped still list their index
        files, so the fixture must filter to the FASTA explicitly.
        """
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id

        subtractions: list[WFSubtraction] = await scope.instantiate_by_key(
            "subtractions",
        )

        subtraction = subtractions[0]

        assert [f.name for f in subtraction.files] == list(SUBTRACTION_FILENAMES)
        assert [p.name for p in subtraction.path.iterdir()] == ["subtraction.fa.gz"]


class TestNewSubtraction:
    async def test_ok(
        self,
        _new_subtraction_job: Job,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that the new_subtraction fixture matches the expected data and writes the
        subtraction data files to the work path.
        """
        new_subtraction: WFNewSubtraction = await scope.instantiate_by_key(
            "new_subtraction",
        )

        assert new_subtraction.id == workflow_data.new_subtraction.id
        assert new_subtraction.name == workflow_data.new_subtraction.name
        assert new_subtraction.nickname == workflow_data.new_subtraction.nickname

        assert filecmp.cmp(
            new_subtraction.fasta_path,
            example_path
            / "subtractions"
            / "arabidopsis_thaliana"
            / "subtraction.fa.gz",
        )

    async def test_upload_and_finalize(
        self,
        _new_subtraction_job: Job,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        new_subtraction: WFNewSubtraction = await scope.instantiate_by_key(
            "new_subtraction",
        )

        for filename in SUBTRACTION_FILENAMES:
            await new_subtraction.upload(
                example_path / "subtractions" / "arabidopsis_thaliana" / filename
            )

        await new_subtraction.finalize({"a": 0.2, "t": 0.2, "c": 0.2, "g": 0.4}, 100)

        assert workflow_data.new_subtraction.gc.a == 0.2
        assert workflow_data.new_subtraction.gc.t == 0.2
        assert workflow_data.new_subtraction.gc.c == 0.2
        assert workflow_data.new_subtraction.gc.g == 0.4
        assert workflow_data.new_subtraction.count == 100

    async def test_already_finalized(
        self,
        _new_subtraction_job: Job,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that an exception is raised when a subtraction is finalized a second time."""
        new_subtraction: WFNewSubtraction = await scope.instantiate_by_key(
            "new_subtraction",
        )

        for filename in SUBTRACTION_FILENAMES:
            await new_subtraction.upload(
                example_path / "subtractions" / "arabidopsis_thaliana" / filename
            )

        workflow_data.new_subtraction.ready = True

        with pytest.raises(JobsAPIConflictError) as err:
            await new_subtraction.finalize(
                {"a": 0.2, "t": 0.2, "c": 0.2, "g": 0.4},
                100,
            )

        assert "Subtraction already finalized" in str(err.value)

    async def test_delete(
        self,
        _new_subtraction_job: Job,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        new_subtraction: WFNewSubtraction = await scope.instantiate_by_key(
            "new_subtraction",
        )

        await new_subtraction.delete()

        assert workflow_data.new_subtraction is None
