import pytest

import virtool.job_manager


@pytest.fixture
def test_job_manager(mocker, loop, test_motor):
    class TestSettings:

        def __init__(self):
            self._data = {
                "db_name": "test",
                "db_host": "localhost",
                "db_port": 27017,
                "rebuild_index_inst": 2,
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

    manager = virtool.job_manager.Manager(loop, test_motor, TestSettings(), mocker.stub(name="dispatch"))

    yield manager

    manager.close()


@pytest.fixture
def test_job():
    return {
        "_id": "4c530449",
        "user_id": "igboyes",
        "proc": 10,
        "mem": 16,
        "task": "nuvs",
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
                "date": "2017-03-24T13:20:35.780926",
                "state": "waiting",
                "stage": None,
                "progress": 0
            },
            {
                "error": None,
                "date": "2017-03-24T13:20:36.123162",
                "state": "running",
                "stage": None,
                "progress": 0
            },
            {
                "error": None,
                "date": "2017-03-24T13:20:36.127059",
                "state": "running",
                "stage": "mk_analysis_dir",
                "progress": 0.091
            },
            {
                "error": None,
                "date": "2017-03-24T13:23:32.254088",
                "state": "complete",
                "stage": "import_results",
                "progress": 1.0
            }
        ]
    }
