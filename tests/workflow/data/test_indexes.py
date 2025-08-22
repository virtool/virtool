from pathlib import Path

import pytest
from pyfixtures import FixtureScope
from syrupy import SnapshotAssertion

from virtool.workflow.data.indexes import WFIndex, WFNewIndex
from virtool.workflow.errors import JobsAPIConflictError, JobsAPINotFoundError
from virtool.workflow.pytest_plugin.data import WorkflowData


class TestIndex:
    async def test_ok(
        self,
        example_path: Path,
        scope: FixtureScope,
        snapshot: SnapshotAssertion,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Test that the index fixture instantiates, contains the expected data, and
        downloads the index files to the work path.
        """
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"

        index: WFIndex = await scope.instantiate_by_key("index")

        assert index.path == work_path / "indexes" / workflow_data.analysis.index.id
        assert index.json_path == index.path / "otus.json"

        assert set(p.name for p in index.path.iterdir()) == {
            "otus.json",
            "otus.json.gz",
            "reference.fa",
            "reference.fa.gz",
            "reference.json.gz",
            "reference.1.bt2",
            "reference.2.bt2",
            "reference.3.bt2",
            "reference.4.bt2",
            "reference.rev.1.bt2",
            "reference.rev.2.bt2",
        }

        for filename in (
            "otus.json.gz",
            "reference.fa.gz",
            "reference.json.gz",
            "reference.1.bt2",
            "reference.2.bt2",
            "reference.3.bt2",
            "reference.4.bt2",
            "reference.rev.1.bt2",
            "reference.rev.2.bt2",
        ):
            assert (index.path / filename).read_bytes() == (
                example_path / "indexes" / filename
            ).read_bytes()

        assert index.get_sequence_length("zo05lb6m") == 3818
        assert index.get_otu_id_by_sequence_id("wqounsl3") == "q432t7gj"

        await index.write_isolate_fasta(
            ["c8gkzu9x", "bo6lf9l2", "ifvpy4ha"],
            work_path / "test.fa",
        )

        assert open(work_path / "test.fa").read() == snapshot(name="fasta")


class TestNewIndex:
    async def test_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Test that the ``new_index`` fixture instantiates and contains the expected data."""
        workflow_data.job.args["index_id"] = workflow_data.new_index.id

        new_index: WFNewIndex = await scope.instantiate_by_key("new_index")

        assert new_index.id == workflow_data.new_index.id
        assert new_index.path == work_path / "indexes" / workflow_data.new_index.id

    async def test_upload_and_finalize(
        self,
        captured_uploads_path: Path,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that the index fixture can be used to upload index files and finalize the index."""
        workflow_data.job.args["index_id"] = workflow_data.new_index.id

        new_index: WFNewIndex = await scope.instantiate_by_key("new_index")

        assert workflow_data.new_index.ready is False

        for filename in (
            "otus.json.gz",
            "reference.fa.gz",
            "reference.json.gz",
            "reference.1.bt2",
            "reference.2.bt2",
            "reference.3.bt2",
            "reference.4.bt2",
            "reference.rev.1.bt2",
            "reference.rev.2.bt2",
        ):
            await new_index.upload(
                example_path / "indexes" / filename,
                "unknown",
            )

        await new_index.finalize()

        assert workflow_data.new_index.ready is True

        assert set(p.name for p in captured_uploads_path.iterdir()) == {
            "otus.json.gz",
            "reference.fa.gz",
            "reference.json.gz",
            "reference.1.bt2",
            "reference.2.bt2",
            "reference.3.bt2",
            "reference.4.bt2",
            "reference.rev.1.bt2",
            "reference.rev.2.bt2",
        }

    async def test_upload_invalid_filename(
        self,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that an invalid filename raises an error."""
        workflow_data.job.args["index_id"] = workflow_data.new_index.id

        new_index: WFNewIndex = await scope.instantiate_by_key("new_index")

        with pytest.raises(JobsAPINotFoundError) as err:
            await new_index.upload(
                example_path / "hmms/annotations.json.gz",
                "unknown",
            )

        assert "Index file not found" in str(err)

    async def test_finalize_incomplete(
        self,
        example_path: Path,
        scope: FixtureScope,
        workflow_data: WorkflowData,
    ):
        """Test that finalizing an index with expected files missing raises an error."""
        workflow_data.job.args["index_id"] = workflow_data.new_index.id

        new_index: WFNewIndex = await scope.instantiate_by_key("new_index")

        for filename in (
            "reference.2.bt2",
            "reference.3.bt2",
        ):
            await new_index.upload(
                example_path / "indexes" / filename,
                "unknown",
            )

        with pytest.raises(JobsAPIConflictError) as err:
            await new_index.finalize()

        assert (
            str(err.value)
            == "Reference requires that all Bowtie2 index files have been uploaded. Missing files: otus.json.gz, reference.1.bt2, reference.4.bt2, reference.fa.gz, reference.json.gz, reference.rev.1.bt2, reference.rev.2.bt2"
        )
