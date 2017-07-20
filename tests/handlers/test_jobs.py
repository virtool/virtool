class TestGet:

    async def test(self, spawn_client, test_job):
        client = await spawn_client()

        await client.db.jobs.insert_one(test_job)

        resp = await client.get("/api/jobs/4c530449")

        assert await resp.json() == {
            "task": "rebuild_index",
            "mem": 16,
            "args": {
                "name": None,
                "analysis_id": "e410429b",
                "sample_id": "1e01a382",
                "username": "igboyes",
                "index_id": "465428b0",
                "algorithm": "nuvs"
            },
            "user": {
                "id": "igboyes"
            },
            "proc": 10,
            "id": "4c530449",
            "status": [
                {
                    "state": "waiting",
                    "error": None,
                    "stage": None,
                    "timestamp": "2017-10-06T20:00:00Z",
                    "progress": 0
                },
                {
                    "state": "running",
                    "error": None,
                    "stage": None,
                    "timestamp": "2017-10-06T20:00:00Z",
                    "progress": 0
                },
                {
                    "state": "running",
                    "error": None,
                    "stage": "mk_analysis_dir",
                    "timestamp": "2017-10-06T20:00:00Z",
                    "progress": 0.091
                },
                {
                    "state": "complete",
                    "error": None,
                    "stage": "import_results",
                    "timestamp": "2017-10-06T20:00:00Z",
                    "progress": 1.0
                }
            ]
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/jobs/4c530449")

        assert await resp_is.not_found(resp)
