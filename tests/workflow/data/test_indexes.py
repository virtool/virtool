from pathlib import Path
from threading import get_ident

import pytest
from pyfixtures import FixtureScope

from virtool.indexes.db import REFERENCE_JSON_V2_FILE_NAME
from virtool.indexes.models import IndexFile
from virtool.references.sqlite import REFERENCE_SQLITE_FILE_NAME
from virtool.workflow.data.indexes import (
    INDEX_SQLITE_FILE_NAME,
    WFIndex,
    _read_json,
    _shape_reference_json_metadata,
)
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


def _get_otu_ref(otu: dict) -> dict:
    return {
        "id": otu["id"],
        "abbreviation": otu["abbreviation"],
        "name": otu["name"],
        "taxid": otu.get("taxid"),
        "version": otu["version"],
    }


def _set_reference_json_v2_index_data(workflow_data: WorkflowData) -> None:
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
            download_url=(
                f"/indexes/{workflow_data.index.id}/files/{REFERENCE_JSON_V2_FILE_NAME}"
            ),
            id=1,
            index=workflow_data.index.id,
            name=REFERENCE_JSON_V2_FILE_NAME,
            size=100,
            type="json",
        )
    ]


def _set_sqlite_reference_data(workflow_data: WorkflowData) -> None:
    _set_reference_json_v2_index_data(workflow_data)
    workflow_data.index.files.append(
        IndexFile(
            download_url=(
                f"/indexes/{workflow_data.index.id}/files/{REFERENCE_SQLITE_FILE_NAME}"
            ),
            id=2,
            index=workflow_data.index.id,
            name=REFERENCE_SQLITE_FILE_NAME,
            size=100,
            type="sqlite",
        )
    )


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
    def test_file_name_is_versioned(self):
        assert INDEX_SQLITE_FILE_NAME == "index.v1.sqlite"

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
            match="Reference metadata does not exist in the SQLite reference",
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

    async def test_load(self, tmp_path: Path):
        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME
        sqlite_path.write_bytes(b"SQLite file")

        index = WFIndex.load("test_index", sqlite_path)

        assert index.path == sqlite_path

    def test_load_raises_for_missing_file(self, tmp_path: Path):
        sqlite_path = tmp_path / INDEX_SQLITE_FILE_NAME

        with pytest.raises(FileNotFoundError):
            WFIndex.load("test_index", sqlite_path)


class TestIndex:
    async def test_legacy_reference_json_uses_otus_json(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Legacy reference JSON is ignored in favor of current OTU JSON."""
        workflow_data.job.args["analysis_id"] = workflow_data.analysis.id
        workflow_data.job.workflow = "build_index"
        workflow_data.index.files = [
            IndexFile(
                download_url=(
                    f"/indexes/{workflow_data.index.id}/files/reference.json.gz"
                ),
                id=1,
                index=workflow_data.index.id,
                name="reference.json.gz",
                size=100,
                type="json",
            ),
        ]

        index: WFIndex = await scope.instantiate_by_key("index")
        otu_summaries_by_sequence_ids = await index.get_otu_summaries_by_sequence_ids(
            ["7h6yaube"],
        )

        index_path = work_path / "indexes" / str(workflow_data.analysis.index.id)

        assert {p.name for p in index_path.iterdir()} == {
            INDEX_SQLITE_FILE_NAME,
            "otus.json",
            "otus.json.gz",
        }
        assert otu_summaries_by_sequence_ids == {
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
            match="Reference metadata does not exist in the SQLite reference",
        ):
            await index.get_reference_metadata()

    async def test_reference_json_v2_ok(
        self,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """Reference JSON v2 is converted to the local workflow index."""
        _set_reference_json_v2_index_data(workflow_data)

        index: WFIndex = await scope.instantiate_by_key("index")
        otus = [otu async for otu in index.iter_otus()]
        otu_summaries_by_sequence_ids = await index.get_otu_summaries_by_sequence_ids(
            ["7oecw8v8", "8f6riell", "7oecw8v8"],
        )
        otu_sequences = [
            sequence
            async for sequence in index.iter_otu_sequences(
                otu_summaries_by_sequence_ids["7oecw8v8"]["id"],
            )
        ]

        index_path = work_path / "indexes" / str(workflow_data.analysis.index.id)

        assert {p.name for p in index_path.iterdir()} == {
            INDEX_SQLITE_FILE_NAME,
            REFERENCE_JSON_V2_FILE_NAME.removesuffix(".gz"),
            REFERENCE_JSON_V2_FILE_NAME,
        }

        assert index.id == workflow_data.analysis.index.id
        assert otus[0]["id"] == "0716c1e1"
        assert otus[0]["version"] == 13
        assert await index.get_reference_metadata() == {
            "id": str(workflow_data.index.reference.id),
            "created_at": "2022-03-28T19:15:18.479570+00:00",
            "data_type": "genome",
            "name": workflow_data.index.reference.name,
            "organism": "virus",
        }
        assert otu_summaries_by_sequence_ids == {
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

    async def test_sqlite_reference_ok(
        self,
        mocker,
        scope: FixtureScope,
        work_path: Path,
        workflow_data: WorkflowData,
    ):
        """A server SQLite reference is loaded without JSON conversion."""
        _set_sqlite_reference_data(workflow_data)
        create_workflow_index = mocker.patch.object(
            WFIndex,
            "create",
        )

        index: WFIndex = await scope.instantiate_by_key("index")

        index_path = work_path / "indexes" / str(workflow_data.analysis.index.id)

        assert {path.name for path in index_path.iterdir()} == {
            REFERENCE_SQLITE_FILE_NAME
        }
        assert index.id == workflow_data.analysis.index.id
        assert (await index.get_reference_metadata())["id"] == str(
            workflow_data.index.reference.id
        )
        assert sorted([otu["version"] async for otu in index.iter_otus()]) == sorted(
            workflow_data.index.manifest.values()
        )
        create_workflow_index.assert_not_called()

    async def test_write_fasta(
        self,
        scope: FixtureScope,
        tmp_path: Path,
        workflow_data: WorkflowData,
    ):
        _set_reference_json_v2_index_data(workflow_data)

        index: WFIndex = await scope.instantiate_by_key("index")
        fasta_path = tmp_path / "reference.fa"

        await index.write_fasta(fasta_path, index.iter_default_sequences())

        assert fasta_path.read_text().startswith(">njbw70pe\n")
