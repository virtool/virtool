import os
import gzip
import json
import copy
import pytest

from virtool.utils import random_alphanumeric

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


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
        "modified": False,
        "verified": False,
        "name": "Prunus virus F",
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
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
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
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
                    }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "modified": False,
        "verified": False,
        "name": "Prunus virus F",
        "_id": "6116cba1"
    }


@pytest.fixture
def test_add_history(monkeypatch, mocker):
    m = mocker.Mock()

    async def fake_add_history(*args, **kwargs):
        return m(*args, **kwargs)

    monkeypatch.setattr("virtool.virus_history.add", fake_add_history)

    return m


@pytest.fixture(scope="session")
def import_json_from_file():
    with gzip.open(os.path.join(FIXTURE_DIR, "files", "import.json.gz"), "rt") as handle:
        return json.load(handle)


@pytest.fixture(scope="function")
def import_json(import_json_from_file):
    return copy.deepcopy(import_json_from_file)


@pytest.fixture(scope="function")
def import_report():
    return {
        "progress": 1,
        "added": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": []
    }


@pytest.fixture
def test_sequences_list():
    return [
        {
            "annotated": True,
            "sequence": "CAT",
            "_id": "NC_001440",
            "definition": "Cucumber mosaic virus RNA 3, complete sequence",
            "_version": 0,
            "isolate_id": "dqz9u58g",
            "host": None,
            "length": 2216
        },
        {
            "annotated": True,
            "sequence": "GAT",
            "_id": "NC_001441",
            "definition": "Cucumber mosaic virus RNA 2, complete sequence",
            "_version": 0,
            "isolate_id": "sad23gat",
            "host": None,
            "length": 2212
        }
    ]


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
            isolate["isolate_id"] = "{}_{}".format(prefix, i)
            isolate["sequences"][0]["isolate_id"] = isolate["isolate_id"]
            isolate["sequences"][0]["_id"] = "{}_seq_{}".format(prefix, i)

    return [first_virus, second_virus, third_virus, fourth_virus]


@pytest.fixture
def get_test_insertions(test_virus, test_change):
    def func(length=30):
        insertions = []

        for i in range(length):
            virus = dict(test_virus, name=random_alphanumeric(7), _id=random_alphanumeric(7), abbreviation="")
            insertions.append((virus, test_change))

        return insertions

    return func


@pytest.fixture
def get_test_replacements(get_test_insertions, test_change):
    def func(length=30):
        insertions = get_test_insertions(length)
        removals = [(virus["_id"], change) for virus, change in get_test_insertions(length)]

        return list(zip(removals, insertions))

    return func


@pytest.fixture
def test_import_handle(mocker, monkeypatch, test_db, test_sequence, test_merged_virus):
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
