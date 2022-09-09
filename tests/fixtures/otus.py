import copy
import gzip
import json
from pathlib import Path

import pytest

TEST_FILES_PATH = Path.cwd() / "tests" / "test_files"


@pytest.fixture(scope="session")
def import_data_file():
    with gzip.open(TEST_FILES_PATH / "otus.json.gz", "rt") as f:
        data = json.load(f)

    return data


@pytest.fixture
def import_data(import_data_file):
    return copy.deepcopy(import_data_file)


@pytest.fixture
def test_otu(static_time):
    return {
        "version": 0,
        "abbreviation": "PVF",
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "source_name": "8816-v2",
                "source_type": "isolate",
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "reference": {"id": "hxn167"},
        "remote_id": None,
        "_id": "6116cba1",
    }


@pytest.fixture
def test_isolate():
    return {
        "id": "cab8b360",
        "default": True,
        "source_name": "8816-v2",
        "source_type": "isolate",
    }


@pytest.fixture
def test_sequence():
    return {
        "_id": "abcd1234",
        "accession": "KX269872",
        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
        "host": "sweet cherry",
        "isolate_id": "cab8b360",
        "reference": {"id": "ref"},
        "remote": None,
        "otu_id": "6116cba1",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
        "segment": None,
    }


@pytest.fixture
def test_merged_otu(static_time):
    return {
        "remote_id": None,
        "version": 0,
        "abbreviation": "PVF",
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "sequences": [
                    {
                        "_id": "abcd1234",
                        "accession": "KX269872",
                        "otu_id": "6116cba1",
                        "isolate_id": "cab8b360",
                        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
                        "host": "sweet cherry",
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "segment": None,
                        "reference": {"id": "ref"},
                        "remote": None,
                    }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate",
            }
        ],
        "reference": {"id": "hxn167"},
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "_id": "6116cba1",
    }


@pytest.fixture(scope="function")
def import_json(import_json_from_file):
    return copy.deepcopy(import_json_from_file)
