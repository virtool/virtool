import pytest
import datetime


@pytest.fixture
def test_change():
    return {
        "_id": "6116cba1.1",
        "description": ["Edited virus", "Prunus virus E"],
        "diff": [
            ["change", "abbreviation", ["PVF", ""]],
            ["change", "name", ["Prunus virus F", "Prunus virus E"]],
            ["change", "version", [0, 1]]
        ],
        "index_id": "unbuilt",
        "index_version": "unbuilt",
        "method_name": "edit",
        "timestamp": datetime.datetime(2017, 10, 6, 20, 0, 0),
        "user_id": "test",
        "virus_id": "6116cba1",
        "virus_name": "Prunus virus F",
        "virus_version": 1
    }


@pytest.fixture
def test_virus_edit():
    """
    An :class:`tuple` containing old and new virus documents for testing history diffing.
     
    """
    return (
        {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                                          "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
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
            "name": "Prunus virus F",
            "version": 0
        },
        {
            "_id": "6116cba1",
            "abbreviation": "",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "isolate_id": "cab8b360",
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                                          "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
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
            "name": "Prunus virus E",
            "version": 1
        }
    )
