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
def test_virus():
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
        "virus_id": "6116cba1",
        "isolate_id": "cab8b360",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
        "segment": None
    }


@pytest.fixture
def test_merged_virus():
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
                        "virus_id": "6116cba1",
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

    monkeypatch.setattr("virtool.virus_history.add", fake_add_history)

    return m


@pytest.fixture(scope="function")
def import_json(import_json_from_file):
    return copy.deepcopy(import_json_from_file)


@pytest.fixture
def test_virus_list(test_merged_virus):
    first_virus = test_merged_virus
    second_virus, third_virus, fourth_virus = (copy.deepcopy(test_merged_virus) for _ in range(3))

    second_virus.update({
        "_id": "067jz0t3",
        "abbreviation": "TST",
        "name": "Test Virus"
    })

    third_virus.update({
        "_id": "067jz213",
        "abbreviation": "EXV",
        "name": "Example Virus"
    })

    fourth_virus.update({
        "_id": "067jz1kj",
        "abbreviation": "FKV",
        "name": "Fake Virus"
    })

    for prefix, virus in [("second", second_virus), ("third", third_virus), ("fourth", fourth_virus)]:
        for i, isolate in enumerate(virus["isolates"]):
            isolate["id"] = "{}_{}".format(prefix, i)
            isolate["sequences"][0]["isolate_id"] = isolate["id"]
            isolate["sequences"][0]["_id"] = "{}_seq_{}".format(prefix, i)

    return [first_virus, second_virus, third_virus, fourth_virus]


@pytest.fixture
def test_import_handle(mocker, monkeypatch, test_db, test_merged_virus):
    test_db.status.insert_one({
        "_id": "import_viruses",
        "file_name": "viruses.json.gz",
        "file_size": 0,
        "virus_count": 0,
        "in_progress": True,
        "progress": 0,
        "inserted": 0,
        "replaced": 0,
        "skipped": 0,
        "errors": None,
        "duplicates": None,
        "conflicts": None,
        "warnings": []
    })

    def func(*args):
        return [test_merged_virus]

    monkeypatch.setattr("virtool.virus_import.load_import_file", func)

    m = mocker.Mock()

    return m
