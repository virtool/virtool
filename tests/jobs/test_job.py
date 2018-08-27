import pytest

import virtool.db.jobs


def test_processor(test_job, static_time):
    """
    Test that the dispatch processor properly formats a raw job document into a dispatchable format.

    """
    assert virtool.db.jobs.processor(test_job) == {
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

    assert await virtool.db.jobs.get_waiting_and_running_ids(dbi) == expected

