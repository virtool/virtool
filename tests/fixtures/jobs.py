import pytest
import virtool.jobs.job
import virtool.jobs.manager


class MockSettings:

    def __init__(self):
        self._data = {
            "db_name": "test",
            "db_host": "localhost",
            "db_port": 27017,
            "build_index_inst": 2,
            "proc": 4,
            "mem": 8
        }

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key):
        return self._data[key]

    def update(self, update_dict):
        self._data.update(update_dict)

    def as_dict(self):
        return dict(self._data)


@pytest.fixture
def test_job_manager(mocker, dbs):
    app = {
        "db": dbs,
        "settings": {}
    }

    manager = virtool.jobs.manager.IntegratedManager(
        app,
        MockSettings()
    )

    yield manager


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
