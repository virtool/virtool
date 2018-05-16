import arrow
import pytest


@pytest.fixture
def test_indexes():
    return [
        {
            "_id": "ncjqqaax",
            "version": 0,
            "created_at": arrow.get("2017-12-12T23:14:25.188Z").datetime,
            "ready": True,
            "has_files": False,
            "reference": {
                "id": "hxn167"
            },
            "user": {
                "id": "igboyes"
            },
            "job": {
                "id": "dnytufhc"
            }
        },
        {
            "_id": "cdffbdjk",
            "version": 1,
            "created_at": arrow.get("2018-01-10T18:21:23.971Z").naive,
            "ready": True,
            "has_files": False,
            "reference": {
                "id": "hxn167"
            },
            "user": {
                "id": "mrott"
            },
            "job": {
                "id": "ihucccoz"
            }
        },
        {
            "_id": "jgwlhulj",
            "version": 2,
            "created_at": arrow.get("2018-02-27T21:50:37.573Z").naive,
            "ready": True,
            "has_files": False,
            "reference": {
                "id": "hxn167"
            },
            "user": {
                "id": "igboyes"
            },
            "job": {
                "id": "dzqsgjnn"
            }
        },
        {
            "_id": "ptlrcefm",
            "version": 3,
            "created_at": arrow.get("2018-02-27T21:54:02.735Z").naive,
            "ready": True,
            "has_files": True,
            "reference": {
                "id": "hxn167"
            },
            "user": {
                "id": "igboyes"
            },
            "job": {
                "id": "zpjzelyc"
            }
        }
    ]
