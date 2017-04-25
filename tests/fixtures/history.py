import pytest


@pytest.fixture
def test_changes():
    return [
        {
            "annotation": None,
            "_id": "c1e16d2c.10",
            "operation": "update",
            "index": "465428b0",
            "index_version": 1,
            "diff": [
                [
                    "change",
                    "modified",
                    [
                        True,
                        False
                    ]
                ],
                [
                    "change",
                    "_version",
                    [
                        9,
                        10
                    ]
                ]
            ],
            "method_name": "verify_virus",
            "timestamp": "2017-03-07T15:52:12.676269Z",
            "user_id": "igboyes",
            "virus_id": "c1e16d2c",
            "virus_name": "Apple stem pitting virus and Apricot latent virus",
            "virus_version": 10
        },
        {
            "annotation": None,
            "_id": "190fe042.3",
            "operation": "update",
            "index": "465428b0",
            "index_version": 1,
            "method_name": "verify_virus",
            "timestamp": "2017-03-07T15:52:16.736736Z",
            "user_id": "igboyes",
            "virus_id": "190fe042",
            "virus_name": "Nectarine stem pitting associated virus",
            "virus_version": 3
        },
        {
            "annotation": None,
            "_id": "cf189b66.0",
            "operation": "update",
            "index": "9cd17bac",
            "index_version": 0,
            "method_name": "add",
            "timestamp": "2017-02-03T14:29:31.789583Z",
            "user_id": "igboyes",
            "virus_id": "cf189b66",
            "virus_name": "Iris yellow spot virus",
            "virus_version": 0
        }
    ]


@pytest.fixture
def test_base_change(static_time):
    return {
        "_id": "test.4",
        "method_name": "create",
        "timestamp": static_time,
        "virus_id": "test",
        "virus_version": 4,
        "user_id": "test",
        "index": "unbuilt",
        "index_version": "unbuilt"
    }
