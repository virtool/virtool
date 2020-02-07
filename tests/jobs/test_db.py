import pytest

import virtool.jobs.db


status = {
    "state": "running",
    "progress": 0.5
}


async def test_processor(dbi, static_time, test_job):
    """
    Test that the dispatch processor properly formats a raw job document into a dispatchable format.

    """
    assert await virtool.jobs.db.processor(dbi, test_job) == {
        "id": "4c530449",
        "created_at": static_time.datetime,
        "args": {
            "algorithm": "nuvs",
            "analysis_id": "e410429b",
            "index_id": "465428b0",
            "name": None,
            "sample_id": "1e01a382",
            "username": "igboyes"
        },
        "mem": 16,
        "proc": 10,
        "progress": 1.0,
        "stage": "import_results",
        "state": "complete",
        "task": "build_index",
        "user": {
            "id": "igboyes"
        }
    }


@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not-empty"])
async def test_get_waiting_and_running(empty, dbi):
    documents = list()

    if not empty:
        documents.append({
            "_id": "foo",
            "status": [
                {"state": "waiting"},
                {"state": "running"},
            ]
        })

    documents.append({
        "_id": "bar",
        "status": [
            {"state": "waiting"},
            {"state": "running"},
            {"state": "complete"}
        ]
    })

    if not empty:
        documents += [
            {
                "_id": "baz",
                "status": [
                    {"state": "waiting"}
                ]
            },
            {
                "_id": "bat",
                "status": [
                    {"state": "waiting"},
                    {"state": "running"}
                ]
            }
        ]

    await dbi.jobs.insert_many(documents)

    expected = list()

    if not empty:
        expected = ["foo", "baz", "bat"]

    assert await virtool.jobs.db.get_waiting_and_running_ids(dbi) == expected


async def test_delete_zombies(dbi):
    documents = [
        {
            "_id": "boo",
            "status": [
                dict(status, state="waiting", progress=0),
                dict(status)
            ]
        },
        {
            "_id": "foo",
            "status": [
                dict(status),
                dict(status, state="cancelled", progress=0.6)
            ]
        },
        {
            "_id": "bar",
            "status": [
                dict(status),
                dict(status, state="error", progress=0.6)
            ]
        },
        {
            "_id": "baz",
            "status": [
                dict(status),
                dict(status, state="complete", progress=1)
            ]
        },
        {
            "_id": "bot",
            "status": [
                dict(status),
                dict(status, state="running", progress=0.3)
            ]
        }
    ]

    await dbi.jobs.insert_many(documents)

    await virtool.jobs.db.delete_zombies(dbi)

    assert await dbi.jobs.find({}, sort=[("_id", 1)]).to_list(None) == [
        documents[2],
        documents[3],
        documents[1]
    ]
