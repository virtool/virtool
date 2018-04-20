import datetime
import pytest

import virtool.job


def test_processor(test_db, test_job, static_time):
    """
    Test that the dispatch processor properly formats a raw job document into a dispatchable format.

    """
    test_db.jobs.insert_one(test_job)

    document = test_db.jobs.find_one()

    assert virtool.job.processor(document) == {
        "id": "4c530449",
        "created_at": static_time,
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
        "task": "rebuild_index",
        "user": {
            "id": "igboyes"
        }
    }


@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not-empty"])
async def test_get_waiting_and_running(empty, test_motor):
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

    await test_motor.jobs.insert_many(documents)

    expected = list()

    if not empty:
        expected = ["foo", "baz", "bat"]

    assert await virtool.job.get_waiting_and_running_ids(test_motor) == expected

