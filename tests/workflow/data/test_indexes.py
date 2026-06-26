from pathlib import Path

import pytest
from pyfixtures import FixtureScope

from virtool.indexes.db import LEGACY_INDEX_FILE_NAMES
from virtool.indexes.models import IndexFile
from virtool.workflow.data.indexes import WFIndex, WFNewIndex
from virtool.workflow.errors import JobsAPIConflictError, JobsAPINotFoundError
from virtool.workflow.pytest_plugin.data import WorkflowData


class TestIndex:
    async def test_legacy_otus_json_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Legacy OTU JSON is loaded when the NDJSON source is unavailable."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"
        workflow_data.index.files = [
            IndexFile(
                download_url=f"/indexes/{workflow_data.index.id}/files/{file_name}",
                id=id_,
                index=workflow_data.index.id,
                name=file_name,
                size=100,
                type="unknown",
            )
            for id_, file_name in enumerate(LEGACY_INDEX_FILE_NAMES, start=1)
        ]

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]

        assert index.path == work_path / "indexes" / workflow_data.analysis.index.id
        assert index.fasta_path == index.path / "reference.fa"

        assert {p.name for p in index.path.iterdir()} == {
            "otus.json",
            "otus.json.gz",
            "reference.fa",
            "reference.fa.gz",
        }

        assert otus[0]["_id"] == "pffj4lst"
        assert index.get_sequence_length("zo05lb6m") == 3818
        assert index.get_otu_id_by_sequence_id("wqounsl3") == "q432t7gj"

    async def test_ndjson_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """The canonical NDJSON source is loaded when present."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"
        workflow_data.index.files = [
            IndexFile(
                download_url=f"/indexes/{workflow_data.index.id}/files/reference.ndjson.gz",
                id=1,
                index=workflow_data.index.id,
                name="reference.ndjson.gz",
                size=100,
                type="ndjson",
            ),
        ]

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]

        assert index.path == work_path / "indexes" / workflow_data.analysis.index.id
        assert {p.name for p in index.path.iterdir()} == {
            "reference.ndjson",
            "reference.ndjson.gz",
        }
        assert otus == [
            {
                "_id": "v2_otu",
                "isolates": [
                    {
                        "default": True,
                        "id": "v2_isolate",
                        "sequences": [
                            {
                                "_id": "v2_sequence",
                                "sequence": "ACGTAC",
                            },
                        ],
                        "source_name": "v2",
                        "source_type": "isolate",
                    },
                ],
            },
        ]
        assert index.get_sequence_length("v2_sequence") == 6
        assert index.get_otu_id_by_sequence_id("v2_sequence") == "v2_otu"

    async def test_ndjson_preferred_over_legacy_json(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """The canonical NDJSON source is preferred during the dual-op period."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"
        workflow_data.index.files = [
            IndexFile(
                download_url=f"/indexes/{workflow_data.index.id}/files/reference.json.gz",
                id=1,
                index=workflow_data.index.id,
                name="reference.json.gz",
                size=100,
                type="json",
            ),
            IndexFile(
                download_url=f"/indexes/{workflow_data.index.id}/files/reference.ndjson.gz",
                id=2,
                index=workflow_data.index.id,
                name="reference.ndjson.gz",
                size=100,
                type="ndjson",
            ),
        ]

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]

        assert index.path == work_path / "indexes" / workflow_data.analysis.index.id
        assert {p.name for p in index.path.iterdir()} == {
            "reference.ndjson",
            "reference.ndjson.gz",
        }
        assert otus[0]["_id"] == "v2_otu"
        assert index.get_sequence_length("v2_sequence") == 6
        assert index.get_otu_id_by_sequence_id("v2_sequence") == "v2_otu"


class TestNewIndex:
    async def test_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Test that the ``new_index`` fixture instantiates and contains the expected
        data.
        """
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
        """Test that the index fixture can be used to upload index files and finalize
        the index.
        """
        workflow_data.job.args["index_id"] = workflow_data.new_index.id

        new_index: WFNewIndex = await scope.instantiate_by_key("new_index")

        assert workflow_data.new_index.ready is False

        for filename in LEGACY_INDEX_FILE_NAMES:
            await new_index.upload(
                example_path / "indexes" / filename,
                "unknown",
            )

        await new_index.finalize()

        assert workflow_data.new_index.ready is True

        assert {p.name for p in captured_uploads_path.iterdir()} == set(
            LEGACY_INDEX_FILE_NAMES
        )

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

        for filename in ("reference.json.gz",):
            await new_index.upload(
                example_path / "indexes" / filename,
                "unknown",
            )

        with pytest.raises(JobsAPIConflictError) as err:
            await new_index.finalize()

        expected = (
            "Job-backed index builds require all legacy index files. missing "
            "files: reference.fa.gz, reference.1.bt2, reference.2.bt2, "
            "reference.3.bt2, reference.4.bt2, reference.rev.1.bt2, "
            "reference.rev.2.bt2"
        )

        assert str(err.value) == expected
