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
            "has_files": False,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "dnytufhc"},
            "ready": True,
        },
        {
            "_id": "cdffbdjk",
            "version": 1,
            "created_at": arrow.get("2018-01-10T18:21:23.971Z").naive,
            "has_files": False,
            "has_json": True,
            "manifest": manifest,
            "job": {"id": "3tt0w336"},
            "reference": {"id": "hxn167"},
            "user": {"id": "mrott"},
            "ready": True,
        },
        {
            "_id": "jgwlhulj",
            "version": 2,
            "created_at": arrow.get("2018-02-27T21:50:37.573Z").naive,
            "has_files": False,
            "has_json": True,
            "manifest": manifest,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "dzqsgjnn"},
            "ready": True,
        },
        {
            "_id": "ptlrcefm",
            "version": 3,
            "created_at": arrow.get("2018-02-27T21:54:02.735Z").naive,
            "has_files": True,
            "has_json": True,
            "manifest": manifest,
            "reference": {"id": "hxn167"},
            "user": {"id": "igboyes"},
            "job": {"id": "zpjzelyc"},
            "ready": True,
        },
    ]
