import pytest


@pytest.fixture
def test_job(static_time):
    return {
        "_id": "4c530449",
        "user": {
            "id": "igboyes"
        },
        "proc": 10,
        "mem": 16,
        "task": "build_index",
        "args": {
            "name": None,
            "username": "igboyes",
            "sample_id": "1e01a382",
            "analysis_id": "e410429b",
            "algorithm": "nuvs",
            "index_id": "465428b0"
        },
        "status": [
            {
                "error": None,
                "timestamp": static_time.datetime,
                "state": "waiting",
                "stage": None,
                "progress": 0
            },
            {
                "error": None,
                "timestamp": static_time.datetime,
                "state": "running",
                "stage": None,
                "progress": 0
            },
            {
                "error": None,
                "timestamp": static_time.datetime,
                "state": "running",
                "stage": "mk_analysis_dir",
                "progress": 0.091
            },
            {
                "error": None,
                "timestamp": static_time.datetime,
                "state": "complete",
                "stage": "import_results",
                "progress": 1.0
            }
        ]
    }
