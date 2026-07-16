import arrow
import pytest


@pytest.fixture
def manifest():
    return {"foo": 1, "bar": 2, "baz": 3}


@pytest.fixture
def test_indexes(manifest):
    return [
        {
            "_id": "ncjqqaax",
            "version": 0,
            "created_at": arrow.get("2017-12-12T23:14:25.188Z").datetime,
            "manifest": manifest,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "dnytufhc"},
            "task": None,
            "ready": True,
        },
        {
            "_id": "cdffbdjk",
            "version": 1,
            "created_at": arrow.get("2018-01-10T18:21:23.971Z").naive,
            "manifest": manifest,
            "job": {"id": "3tt0w336"},
            "task": None,
            "reference": {"id": "hxn167"},
            "user": {"id": "mrott"},
            "ready": True,
        },
        {
            "_id": "jgwlhulj",
            "version": 2,
            "created_at": arrow.get("2018-02-27T21:50:37.573Z").naive,
            "manifest": manifest,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "dzqsgjnn"},
            "task": None,
            "ready": True,
        },
        {
            "_id": "ptlrcefm",
            "version": 3,
            "created_at": arrow.get("2018-02-27T21:54:02.735Z").naive,
            "manifest": manifest,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "zpjzelyc"},
            "task": None,
            "ready": True,
        },
    ]
