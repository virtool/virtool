from pathlib import Path
from threading import get_ident

import pytest
from pyfixtures import FixtureScope

from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.models import IndexFile
from virtool.workflow.data.index_sqlite import INDEX_SQLITE_FILE_NAME
from virtool.workflow.data.indexes import (
    WFIndex,
    WFNewIndex,
    _read_json,
    _shape_reference_json_metadata,
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
            "otu_id": "sqlite_otu",
            "segment": None,
            "sequence": "ACGTAC",
        },
        {
            "_id": "sqlite_other_sequence",
            "accession": "SQL456",
            "definition": "SQLite non-default sequence",
            "host": "",
            "isolate_id": "sqlite_other_isolate",
            "otu_id": "sqlite_otu",
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
            download_url=(f"/indexes/{workflow_data.index.id}/files/reference.json.gz"),
            id=1,
            index=workflow_data.index.id,
            name="reference.json.gz",
            size=100,
            type="json",
        )
    ]


def test_shape_reference_json_metadata_preserves_required_values():
    data = {
        "_id": "reference",
        "created_at": "2026-01-15T19:55:34.203324Z",
        "data_type": "genome",
        "name": "Plant Viruses",
        "organism": "",
    }

    assert _shape_reference_json_metadata(data) == {
        "id": "reference",
        "created_at": "2026-01-15T19:55:34.203324Z",
        "data_type": "genome",
        "name": "Plant Viruses",
        "organism": "",
    }


def test_shape_reference_json_metadata_returns_none_without_id():
    assert (
        _shape_reference_json_metadata(
            {
                "created_at": "2026-01-15T19:55:34.203324Z",
                "data_type": "genome",
                "name": "Plant Viruses",
                "organism": "virus",
            }
        )
        is None
    )


class TestWFIndex:
    async def test_create(self, tmp_path: Path):
        def iter_otus():
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

    async def test_create_without_reference(self, tmp_path: Path):
        def iter_otus():
            yield _get_sqlite_otu()

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            None,
            iter_otus(),
        )

        assert [otu async for otu in index.iter_otus()] == [_get_source_otu()]

        with pytest.raises(
            ValueError,
            match="Reference metadata does not exist in the index",
        ):
            await index.get_reference_metadata()

    async def test_read_json_decodes_off_event_loop_thread(self, mocker, tmp_path):
        event_loop_thread_id = get_ident()
        decoding_thread_ids = []

        def loads(_data):
            decoding_thread_ids.append(get_ident())
            return {"id": "decoded"}

        mocker.patch("virtool.workflow.data.indexes.json.loads", side_effect=loads)

        path = tmp_path / "index.json"
        path.write_text("{}")

        assert await _read_json(path) == {"id": "decoded"}
        assert len(decoding_thread_ids) == 1
        assert decoding_thread_ids[0] != event_loop_thread_id

    async def test_create_allows_virtool_isolate_ids_reused_across_otus(
        self,
        tmp_path: Path,
    ):
        first_otu = _get_sqlite_otu()
        first_otu["_id"] = "first_otu"
        first_otu["isolates"] = first_otu["isolates"][:1]
        first_otu["isolates"][0]["id"] = "reused_isolate"
        first_otu["isolates"][0]["sequences"][0]["_id"] = "first_sequence"

        second_otu = _get_sqlite_otu()
        second_otu["_id"] = "second_otu"
        second_otu["isolates"] = second_otu["isolates"][:1]
        second_otu["isolates"][0]["id"] = "reused_isolate"
        second_otu["isolates"][0]["sequences"][0]["_id"] = "second_sequence"

        def iter_otus():
            yield first_otu
            yield second_otu

        index = await WFIndex.create(
            "test_index",
            tmp_path / INDEX_SQLITE_FILE_NAME,
            None,
            iter_otus(),
        )

        loaded_otus = {otu["id"]: otu async for otu in index.iter_otus()}
        otu_refs = await index.get_otu_refs_by_sequence_ids(
            ["first_sequence", "second_sequence"],
        )
        first_otu_sequences = [
            sequence async for sequence in index.iter_otu_sequences("first_otu")
        ]
        second_otu_sequences = [
            sequence async for sequence in index.iter_otu_sequences("second_otu")
        ]

        assert loaded_otus["first_otu"]["isolates"][0]["sequences"][0]["id"] == (
            "first_sequence"
        )
        assert loaded_otus["second_otu"]["isolates"][0]["sequences"][0]["id"] == (
            "second_sequence"
        )
        assert otu_refs["first_sequence"]["id"] == "first_otu"
        assert otu_refs["second_sequence"]["id"] == "second_otu"
        assert [sequence["id"] for sequence in first_otu_sequences] == [
            "first_sequence",
        ]
        assert [sequence["id"] for sequence in second_otu_sequences] == [
            "second_sequence",
        ]
        assert first_otu_sequences[0]["isolate_id"] == "reused_isolate"
        assert first_otu_sequences[0]["otu_id"] == "first_otu"
        assert second_otu_sequences[0]["isolate_id"] == "reused_isolate"
        assert second_otu_sequences[0]["otu_id"] == "second_otu"

    async def test_load(self, tmp_path: Path):
        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME
        sqlite_path.write_bytes(b"SQLite file")

        index = WFIndex.load("test_index", sqlite_path)

        assert index.path == sqlite_path

    async def test_iter_otus_preserves_json_shape(self, tmp_path: Path):
        otu = _get_sqlite_otu()

        def iter_otus():
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
        def iter_otus():
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
        def iter_otus():
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
        def iter_otus():
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
        def iter_otus():
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
    async def test_otus_json_fallback(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """OTU JSON is converted when reference JSON is not available."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"
        workflow_data.index.files = []

        index: WFIndex = await scope.instantiate_by_key("index")
        otu_refs_by_sequence_ids = await index.get_otu_refs_by_sequence_ids(
            ["7h6yaube"],
        )

        index_path = work_path / "indexes" / workflow_data.analysis.index.id

        assert {p.name for p in index_path.iterdir()} == {
            INDEX_SQLITE_FILE_NAME,
            "otus.json",
            "otus.json.gz",
        }
        assert otu_refs_by_sequence_ids == {
            "7h6yaube": {
                "id": "pffj4lst",
                "abbreviation": "ABTV",
                "name": "Abaca bunchy top virus",
                "taxid": None,
                "version": 0,
            },
        }

        with pytest.raises(
            ValueError,
            match="Reference metadata does not exist in the index",
        ):
            await index.get_reference_metadata()

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
            INDEX_SQLITE_FILE_NAME,
            "reference.json",
            "reference.json.gz",
        }

        assert index.id == workflow_data.analysis.index.id
        assert otus[0]["id"] == "0716c1e1"
        assert otus[0]["version"] == 13
        with pytest.raises(
            ValueError,
            match="Reference metadata does not exist in the index",
        ):
            await index.get_reference_metadata()
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

        for filename in INDEX_FILE_NAMES:
            await new_index.upload(
                example_path / "indexes" / filename,
                "unknown",
            )

        await new_index.finalize()

        assert workflow_data.new_index.ready is True

        assert {p.name for p in captured_uploads_path.iterdir()} == set(
            INDEX_FILE_NAMES
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
            "Reference requires that all Bowtie2 index files have been uploaded. "
            "Missing files: reference.fa.gz, reference.1.bt2, reference.2.bt2, "
            "reference.3.bt2, reference.4.bt2, reference.rev.1.bt2, "
            "reference.rev.2.bt2"
        )

        assert str(err.value) == expected
