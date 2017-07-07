import pytest
import datetime
from copy import deepcopy

import virtool.virus_history
import virtool.virus
from .viruses import test_merged_virus


@pytest.fixture
def test_change():
    return {
        "_id": "6116cba1.1",
        "description": ["Edited virus", "Prunus virus E"],
        "index": {
            "id": "unbuilt",
            "version": "unbuilt"
        },
        "method_name": "edit",
        "created_at": "2017-10-06T20:00:00Z",
        "user": {
            "id": "test"
        },
        "virus": {
            "id": "6116cba1",
            "name": "Prunus virus F",
            "version": 1
        }
    }


@pytest.fixture
def test_changes(test_change):
    return [
        test_change,
        dict(test_change, _id="foobar.1"),
        dict(test_change, _id="foobar.2")
    ]


@pytest.fixture
def setup_test_history(test_motor, test_merged_virus):

    async def func(remove=False):

        nonlocal test_merged_virus

        # Apply a series of changes to a test virus document to build up a history.
        await virtool.virus_history.add(test_motor, "create", None, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "abbreviation": "TST",
            "version": 1
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        # We will try to patch to this version of the joined virus.
        expected = deepcopy(old)

        test_merged_virus.update({
            "name": "Test Virus",
            "version": 2
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "isolates": [],
            "version": 3
        })

        await virtool.virus_history.add(test_motor, "remove_isolate", old, test_merged_virus, "Description", "test")

        if remove:
            old = deepcopy(test_merged_virus)

            test_merged_virus = {
                "_id": "6116cba1"
            }

            await virtool.virus_history.add(test_motor, "remove", old, test_merged_virus, "Description", "test")
        else:
            virus, sequences = virtool.virus.split_virus(test_merged_virus)
            await test_motor.viruses.insert_one(virus)

        return expected

    return func


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
