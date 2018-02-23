import pytest
import datetime


@pytest.fixture
def test_change(static_time):
    return {
        "_id": "6116cba1.1",
        "method_name": "edit",
        "description": "Edited virus Prunus virus E",
        "created_at": static_time,
        "diff": [
            ["change", "abbreviation", ["PVF", ""]],
            ["change", "name", ["Prunus virus F", "Prunus virus E"]],
            ["change", "version", [0, 1]]
        ],
        "index": {
            "id": "unbuilt",
            "version": "unbuilt"
        },
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
            "name": "Prunus virus F",
            "schema": [],
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
            "name": "Prunus virus E",
            "schema": [],
            "version": 1
        }
    )


@pytest.fixture
def create_mock_history(test_motor):
    async def func(remove):
        documents = [
            {
                "_id": "6116cba1.0",
                "created_at": datetime.datetime(2017, 7, 12, 16, 0, 50, 495000),
                "description": "Description",
                "diff": {
                    "_id": "6116cba1",
                    "abbreviation": "PVF",
                    "imported": True,
                    "isolates": [
                        {
                            "source_name": "8816-v2",
                            "source_type": "isolate",
                            "default": True,
                            "id": "cab8b360",
                            "sequences": [
                                {
                                    "_id": "KX269872",
                                    "definition": "Prunus virus F isolate "
                                    "8816-s2 segment RNA2 "
                                    "polyprotein 2 gene, "
                                    "complete cds.",
                                    "host": "sweet cherry",
                                    "isolate_id": "cab8b360",
                                    "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                                    "virus_id": "6116cba1",
                                    "segment": None
                                }
                            ]
                        }
                    ],
                    "schema": [],
                    "last_indexed_version": 0,
                    "lower_name": "prunus virus f",
                    "verified": False,
                    "name": "Prunus virus F",
                    "version": 0
                },
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "create",
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 0
                }
            },
            {
                "_id": "6116cba1.1",
                "created_at": datetime.datetime(2017, 7, 12, 16, 0, 50, 600000),
                "description": "Description",
                "diff": [
                    ["change", "version", [0, 1]],
                    ["change", "abbreviation", ["PVF", "TST"]]
                ],
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "update",
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                }
            },
            {
                "_id": "6116cba1.2",
                "created_at": datetime.datetime(2017, 7, 12, 16, 0, 50, 602000),
                "description": "Description",
                "diff": [
                    ["change", "version", [1, 2]],
                    ["change", "name", ["Prunus virus F", "Test Virus"]]
                ],
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "update",
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 2
                }
            },
            {
                "_id": "6116cba1.3",
                "created_at": datetime.datetime(2017, 7, 12, 16, 0, 50, 603000),
                "description": "Description",
                "diff": [
                    ["change", "version", [2, 3]],
                    ["remove", "isolates", [[0, {
                        "default": True,
                        "id": "cab8b360",
                        "sequences": [{
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                                          "cds.",
                            "host": "sweet cherry",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "virus_id": "6116cba1",
                            "segment": None
                        }],
                        "source_name": "8816-v2",
                        "source_type": "isolate"}]
                    ]]],
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "remove_isolate",
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Test Virus",
                    "version": 3
                }
            }
        ]

        virus = None

        if remove:
            documents.append({
                "_id": "6116cba1.removed",
                "created_at": datetime.datetime(2017, 7, 12, 16, 0, 50, 605000),
                "description": "Description",
                "diff": {
                    "_id": "6116cba1",
                    "abbreviation": "TST",
                    "imported": True,
                    "isolates": [],
                    "last_indexed_version": 0,
                    "lower_name": "prunus virus f",
                    "verified": False,
                    "name": "Test Virus",
                    "version": 3,
                    "schema": [],
                },
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "remove",
                "user": {
                    "id": "test"
                },
                "virus": {
                    "id": "6116cba1",
                    "name": "Test Virus",
                    "version": "removed"
                }
            })
        else:
            virus = {
                "_id": "6116cba1",
                "abbreviation": "TST",
                "imported": True,
                "isolates": [],
                "last_indexed_version": 0,
                "lower_name": "prunus virus f",
                "verified": False,
                "name": "Test Virus",
                "version": 3,
                "schema": [],
            }

            await test_motor.viruses.insert_one(virus)

        await test_motor.history.insert_many(documents)

        return virus

    return func

