from pathlib import Path

import pytest
from pyfixtures import FixtureScope

from virtool.indexes.db import LEGACY_INDEX_FILE_NAMES
from virtool.indexes.index_sqlite import (
    INDEX_SQLITE_FILE_NAME,
)
from virtool.indexes.models import IndexFile
from virtool.workflow.data.indexes import (
    WFIndex,
    WFNewIndex,
)
from virtool.workflow.errors import JobsAPIConflictError, JobsAPINotFoundError
from virtool.workflow.pytest_plugin.data import WorkflowData


def _get_sqlite_reference() -> dict:
    return {
        "_id": "hxn167",
        "created_at": "2026-01-15T19:55:34.203324Z",
        "data_type": "genome",
        "name": "Plant Viruses",
        "organism": "virus",
    }


def _get_sqlite_otu(version: int = 1) -> dict:
    return {
        "_id": "sqlite_otu",
        "abbreviation": "SQL",
        "isolates": [
            {
                "default": True,
                "id": "sqlite_isolate",
                "sequences": [
                    {
                        "_id": "sqlite_sequence",
                        "accession": "SQL123",
                        "definition": "SQLite fixture sequence",
                        "host": "",
                        "segment": None,
                        "sequence": "ACGTAC",
                    },
                ],
                "source_name": "sqlite",
                "source_type": "isolate",
            },
            {
                "default": False,
                "id": "sqlite_other_isolate",
                "sequences": [
                    {
                        "_id": "sqlite_other_sequence",
                        "accession": "SQL456",
                        "definition": "SQLite non-default sequence",
                        "host": "",
                        "segment": None,
                        "sequence": "TTTTAA",
                    },
                ],
                "source_name": "sqlite other",
                "source_type": "isolate",
            },
        ],
        "name": "SQLite OTU",
        "schema": [],
        "taxid": None,
        "version": version,
    }


def _get_sqlite_sequences() -> list[dict]:
    return [
        {
            "_id": "sqlite_sequence",
            "accession": "SQL123",
            "definition": "SQLite fixture sequence",
            "host": "",
            "isolate_id": "sqlite_isolate",
            "segment": None,
            "sequence": "ACGTAC",
        },
        {
            "_id": "sqlite_other_sequence",
            "accession": "SQL456",
            "definition": "SQLite non-default sequence",
            "host": "",
            "isolate_id": "sqlite_other_isolate",
            "segment": None,
            "sequence": "TTTTAA",
        },
    ]


def _get_source_otu(version: int = 1) -> dict:
    otu = _get_sqlite_otu(version)
    otu["id"] = otu.pop("_id")

    for isolate in otu["isolates"]:
        for sequence in isolate["sequences"]:
            sequence["id"] = sequence.pop("_id")

    return otu


def _get_source_sequences() -> list[dict]:
    sequences = _get_sqlite_sequences()

    for sequence in sequences:
        sequence["id"] = sequence.pop("_id")

    return sequences


def _get_otu_ref(otu: dict) -> dict:
    return {
        "id": otu["id"],
        "abbreviation": otu["abbreviation"],
        "name": otu["name"],
        "taxid": otu.get("taxid"),
        "version": otu["version"],
    }


def _set_reference_json_index_data(workflow_data: WorkflowData) -> None:
    workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
    workflow_data.job.workflow = "build_index"
    workflow_data.index.manifest = {
        "0b9f16ba": 1,
        "b67008d3": 2,
        "51c5d911": 3,
        "41915321": 4,
        "q1gu14xk": 5,
        "9457c8c7": 6,
        "qe8afugr": 7,
        "lliyqfxq": 8,
        "c85dca33": 9,
        "a89b6529": 10,
        "6bb1fe0b": 11,
        "rpz4bwux": 12,
        "0716c1e1": 13,
        "4ydohve6": 14,
        "579c7055": 15,
        "2oafytcq": 16,
        "400ab879": 17,
        "898l72tb": 18,
        "xxv54nax": 19,
        "kqpzbw0s": 20,
    }
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


class TestWFIndex:
    async def test_create(self, tmp_path: Path):
        async def iter_otus():
            yield _get_sqlite_otu()

        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

        index = await WFIndex.create(
            "test_index",
            sqlite_path,
            _get_sqlite_reference(),
            iter_otus(),
        )

        assert index.path == sqlite_path
        assert sqlite_path.exists()
        assert await index.get_reference_metadata() == {
            "id": "hxn167",
            "created_at": "2026-01-15T19:55:34.203324Z",
            "data_type": "genome",
            "name": "Plant Viruses",
            "organism": "virus",
        }
        assert [otu async for otu in index.iter_otus()] == [_get_source_otu()]

    async def test_load(self, tmp_path: Path):
        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME
        sqlite_path.write_bytes(b"SQLite file")

        index = WFIndex.load("test_index", sqlite_path)

        assert index.path == sqlite_path

    async def test_iter_otus_preserves_json_shape(self, tmp_path: Path):
        otu = _get_sqlite_otu()

        async def iter_otus():
            yield otu

        otu["schema"] = [
            {
                "molecule": "ssRNA",
                "name": "genome",
                "required": True,
            },
        ]

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence["segment"] = "genome"

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            _get_sqlite_reference(),
            iter_otus(),
        )
        loaded_otus = [loaded_otu async for loaded_otu in index.iter_otus()]

        expected_otu = _get_source_otu()
        expected_otu["schema"] = [
            {
                "molecule": "ssRNA",
                "name": "genome",
                "required": True,
            },
        ]

        for isolate in expected_otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence["segment"] = "genome"

        assert loaded_otus == [expected_otu]
        assert loaded_otus[0]["schema"][0]["required"] is True
        assert loaded_otus[0]["isolates"][0]["default"] is True
        assert loaded_otus[0]["isolates"][1]["default"] is False

    async def test_iter_otus_raises_when_otu_has_no_isolates(self, tmp_path: Path):
        async def iter_otus():
            otu = _get_sqlite_otu()
            otu["isolates"] = []

            yield otu

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            _get_sqlite_reference(),
            iter_otus(),
        )

        with pytest.raises(ValueError, match="has no isolates"):
            [otu async for otu in index.iter_otus()]

    async def test_iter_otus_raises_when_isolate_has_no_sequences(
        self,
        tmp_path: Path,
    ):
        async def iter_otus():
            otu = _get_sqlite_otu()
            otu["isolates"][0]["sequences"] = []

            yield otu

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            _get_sqlite_reference(),
            iter_otus(),
        )

        with pytest.raises(ValueError, match="has no sequences"):
            [otu async for otu in index.iter_otus()]

    def test_load_raises_for_missing_file(self, tmp_path: Path):
        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

        with pytest.raises(FileNotFoundError):
            WFIndex.load("test_index", sqlite_path)

    async def test_iter_sequences_reads_multiple_batches(self, mocker, tmp_path: Path):
        async def iter_otus():
            yield _get_sqlite_otu()

        mocker.patch("virtool.workflow.data.indexes._SQLITE_SEQUENCE_BATCH_SIZE", 1)

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            _get_sqlite_reference(),
            iter_otus(),
        )

        assert [sequence async for sequence in index.iter_sequences()] == sorted(
            _get_source_sequences(),
            key=lambda sequence: sequence["id"],
        )

    async def test_get_otu_refs_by_sequence_ids_raises_for_missing_sequence(
        self,
        tmp_path: Path,
    ):
        async def iter_otus():
            yield _get_sqlite_otu()

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            _get_sqlite_reference(),
            iter_otus(),
        )

        with pytest.raises(ValueError, match="does not exist in the index"):
            await index.get_otu_refs_by_sequence_ids(["missing_sequence"])


class TestIndex:
    async def test_reference_json_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Reference JSON is converted to the local workflow index."""
        _set_reference_json_index_data(workflow_data)

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]
        reference_metadata = await index.get_reference_metadata()
        otu_refs_by_sequence_ids = await index.get_otu_refs_by_sequence_ids(
            ["7oecw8v8", "8f6riell", "7oecw8v8"],
        )
        otu_sequences = [
            sequence
            async for sequence in index.iter_otu_sequences(
                otu_refs_by_sequence_ids["7oecw8v8"]["id"],
            )
        ]

        index_path = work_path / "indexes" / workflow_data.analysis.index.id

        assert {p.name for p in index_path.iterdir()} == {
            "index.sqlite",
            "reference.json",
            "reference.json.gz",
        }

        assert index.id == workflow_data.analysis.index.id
        assert otus[0]["id"] == "0716c1e1"
        assert otus[0]["version"] == 13
        assert reference_metadata == {
            "id": workflow_data.index.reference.id,
            "created_at": "2022-03-28T19:15:18.479570+00:00",
            "data_type": "genome",
            "name": workflow_data.index.reference.name,
            "organism": "virus",
        }
        assert otu_refs_by_sequence_ids == {
            "7oecw8v8": {
                "id": "b67008d3",
                "abbreviation": "HpLV",
                "name": "Hop latent virus",
                "taxid": None,
                "version": 2,
            },
            "8f6riell": {
                "id": "b67008d3",
                "abbreviation": "HpLV",
                "name": "Hop latent virus",
                "taxid": None,
                "version": 2,
            },
        }
        assert {sequence["id"] for sequence in otu_sequences} == {
            "7oecw8v8",
            "8f6riell",
            "ixnaodb8",
        }

    async def test_reference_json_used_when_sqlite_file_record_exists(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """The workflow index only reads reference JSON during initialization."""
        _set_reference_json_index_data(workflow_data)
        workflow_data.index.files.append(
            IndexFile(
                download_url=f"/indexes/{workflow_data.index.id}/files/index.sqlite.gz",
                id=21,
                index=workflow_data.index.id,
                name="index.sqlite.gz",
                size=100,
                type="sqlite",
            ),
        )

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]

        index_path = work_path / "indexes" / workflow_data.analysis.index.id

        assert index.id == workflow_data.analysis.index.id
        assert {p.name for p in index_path.iterdir()} == {
            "index.sqlite",
            "reference.json",
            "reference.json.gz",
        }
        assert otus[0]["id"] == "0716c1e1"
        assert otus[0]["version"] == 13

    async def test_write_fasta(
        self,
        scope: FixtureScope,
        tmp_path: Path,
        workflow_data: WorkflowData,
    ):
        _set_reference_json_index_data(workflow_data)

        index: WFIndex = await scope.instantiate_by_key("index")
        fasta_path = tmp_path / "reference.fa"

        await index.write_fasta(fasta_path, index.iter_default_sequences())

        assert fasta_path.read_text().startswith(">njbw70pe\n")


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
