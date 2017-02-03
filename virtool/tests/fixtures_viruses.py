import os
import gzip
import json
import copy
import pytest

from virtool.viruses import Collection

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


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


@pytest.fixture(scope="function")
def import_transaction(mock_transaction):
    def create_transaction(options=None):
        data = dict({
            "replace": False
        }, file_id="import.json.gz")

        if options:
            data.update(options)

        return mock_transaction({
            "interface": "viruses",
            "method": "import_file",
            "data": data
        }, permissions=["modify_virus"])

    return create_transaction


@pytest.fixture(scope="function")
def viruses_collection(mock_collection, called_tester, mock_settings, mock_motor, mock_pymongo):
    def get_db_client(sync=False):
        if sync:
            return mock_pymongo
        return mock_motor

    mock_settings.get_db_client = get_db_client

    collections = {
        "history": mock_collection
    }

    collections["history"].add_coroutine("add")
    collections["history"].add_coroutine("add_for_import")

    return Collection(called_tester(), collections, mock_settings, called_tester())


def create_merged_virus():
    return {
        "last_indexed_version": 0,
        "abbreviation": "CMV",
        "modified": False,
        "_id": "067jz0t8",
        "_version": 0,
        "name": "Cucumber mosaic virus",
        "isolates": [
            {
                "sequences": [
                    {
                        "annotated": True,
                        "sequence": "CAT",
                        "_id": "NC_001440",
                        "definition": "Cucumber mosaic virus RNA 3, complete sequence",
                        "_version": 0,
                        "isolate_id": "dqz9u58g",
                        "host": None,
                        "length": 2216
                    }
                ],
                "source_name": "Fny",
                "isolate_id": "dqz9u58g",
                "source_type": "strain",
                "default": True
            },
            {
                "sequences": [
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
                ],
                "source_name": "Fny",
                "isolate_id": "sad23gat",
                "source_type": "strain",
                "default": False
            }
        ]
    }


@pytest.fixture
def virus_document():
    return {
        "last_indexed_version": 0,
        "abbreviation": "CMV",
        "modified": False,
        "_id": "067jz0t8",
        "_version": 0,
        "name": "Cucumber mosaic virus",
        "isolates": [
            {
                "source_name": "Fny",
                "isolate_id": "dqz9u58g",
                "source_type": "strain",
                "default": True
            },
            {
                "source_name": "Fny",
                "isolate_id": "sad23gat",
                "source_type": "strain",
                "default": False
            }
        ]
    }


@pytest.fixture
def sequences_list():
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
def merged_virus():
    return create_merged_virus()


@pytest.fixture
def virus_list():
    first_virus = create_merged_virus()
    second_virus = create_merged_virus()
    third_virus = create_merged_virus()
    fourth_virus = create_merged_virus()

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
