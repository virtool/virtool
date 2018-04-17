import os
import sys
import gzip
import json
import copy
import pytest

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")


@pytest.fixture("session")
def import_data_file():
    with gzip.open(os.path.join(TEST_FILES_PATH, "viruses.json.gz"), "rt") as f:
        data = json.load(f)

    return data


@pytest.fixture
def import_data(import_data_file):
    return copy.deepcopy(import_data_file)


@pytest.fixture
def test_kind():
    return {
        "version": 0,
        "abbreviation": "PVF",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "ref": {
            "id": "abc12345"
        },
        "_id": "6116cba1"
    }


@pytest.fixture
def test_isolate():
    return {
        "id": "cab8b360",
        "default": True,
        "source_name": "8816-v2",
        "source_type": "isolate"
    }


@pytest.fixture
def test_sequence():
    return {
        "_id": "KX269872",
        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
        "host": "sweet cherry",
        "kind_id": "6116cba1",
        "isolate_id": "cab8b360",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
        "segment": None
    }


@pytest.fixture
def test_merged_kind():
    return {
        "version": 0,
        "abbreviation": "PVF",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "sequences": [
                    {
                        "_id": "KX269872",
                        "kind_id": "6116cba1",
                        "isolate_id": "cab8b360",
                        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                        "host": "sweet cherry",
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "segment": None
                    }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "ref": {
            "id": "abc12345"
        },
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "_id": "6116cba1"
    }


@pytest.fixture
def test_add_history(monkeypatch, mocker):
    m = mocker.Mock()

    async def fake_add_history(*args, **kwargs):
        return m(*args, **kwargs)

    monkeypatch.setattr("virtool.db.history.add", fake_add_history)

    return m


@pytest.fixture(scope="function")
def import_json(import_json_from_file):
    return copy.deepcopy(import_json_from_file)


@pytest.fixture
def test_kind_list(test_merged_kind):
    first_kind = test_merged_kind
    second_kind, third_kind, fourth_kind = (copy.deepcopy(test_merged_kind) for _ in range(3))

    second_kind.update({
        "_id": "067jz0t3",
        "abbreviation": "TST",
        "name": "Test Virus"
    })

    third_kind.update({
        "_id": "067jz213",
        "abbreviation": "EXV",
        "name": "Example Virus"
    })

    fourth_kind.update({
        "_id": "067jz1kj",
        "abbreviation": "FKV",
        "name": "Fake Virus"
    })

    for prefix, kind in [("second", second_kind), ("third", third_kind), ("fourth", fourth_kind)]:
        for i, isolate in enumerate(kind["isolates"]):
            isolate["id"] = "{}_{}".format(prefix, i)
            isolate["sequences"][0]["isolate_id"] = isolate["id"]
            isolate["sequences"][0]["_id"] = "{}_seq_{}".format(prefix, i)

    return [first_kind, second_kind, third_kind, fourth_kind]
