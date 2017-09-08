import time
import pytest
import datetime

import virtool.job


class TestDispatchProcessor:

    def test(self, test_db, test_job):
        """
        Test that the dispatch processor properly formats a raw job document into a dispatchable format.
         
        """
        test_db.jobs.insert_one(test_job)

        document = test_db.jobs.find_one()

        assert virtool.job.dispatch_processor(document) == {
            "id": "4c530449",
            "created_at": datetime.datetime(2017, 10, 6, 20, 0),
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
