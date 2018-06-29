import time
import queue
import pytest
import collections
import multiprocessing

import virtool.jobs.job
import virtool.jobs.dummy
import virtool.jobs.manager


class MockQueue:

    def __init__(self):
        self.messages = collections.deque()

    def put(self, message):
        self.messages.append(message)

    def get(self, block=False, timeout=3):
        elapsed = 0

        if block:
            while elapsed < timeout:
                try:
                    return self.messages.popleft()
                except IndexError:
                    pass

                time.sleep(0.3)
                elapsed += 0.3
        else:
            try:
                return self.messages.popleft()
            except IndexError:
                pass

        raise queue.Empty()

    def empty(self):
        return len(self.messages) == 0


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
def test_job_manager(mocker, loop, test_motor):

    manager = virtool.jobs.manager.Manager(
        loop,
        test_motor,
        MockSettings(),
        mocker.stub(name="capture_exception")
    )

    yield manager

    loop.run_until_complete(manager.close())


@pytest.fixture
def test_queue(monkeypatch):

    mock_queue = MockQueue()

    monkeypatch.setattr("multiprocessing.Queue", lambda: mock_queue)

    return mock_queue


@pytest.fixture
def mock_job_class(monkeypatch, mocker):
    # Mock the :class:`.RebuildIndex` job class so we can see what calls are made on it and its returned instance.
    mock_obj = mocker.Mock()
    mock_class = mocker.Mock(name="RebuildIndex", return_value=mock_obj)

    monkeypatch.setattr("virtool.job_classes.TASK_CLASSES", {
        "build_index": mock_class
    })

    return mock_class, mock_obj


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


@pytest.fixture
def test_task_class():
    return


@pytest.fixture
def test_task_inst(test_task_class):
    job_id = "foobar"

    settings = {
        "db_name": "test",
        "db_host": "localhost",
        "db_port": 27017
    }

    queue = multiprocessing.Queue()

    task = "test_task"
    task_args = dict(message="hello world")
    proc = 1
    mem = 1

    job = virtool.jobs.dummy.DummyJob(job_id, settings, queue, task, task_args, proc, mem)

    return job
