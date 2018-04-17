import pytest


class TestFind:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.indexes.insert_many([
            {
                "_id": "foo",
                "version": 0,
                "created_at": static_time,
                "ready": True,
                "has_files": True,
                "user": {
                    "id": "test"
                },
                "job": {
                    "id": "abh675"
                }
            },
            {
                "_id": "bar",
                "version": 1,
                "created_at": static_time,
                "ready": False,
                "has_files": True,
                "user": {
                    "id": "test"
                },
                "job": {
                    "id": "sj82la"
                }
            }
        ])

        resp = await client.get("/api/indexes")

        assert resp.status == 200

        assert await resp.json() == {
            "documents": [
                {
                    "created_at": "2015-10-06T20:00:00Z",
                    "has_files": True,
                    "id": "bar",
                    "modification_count": 0,
                    "modified_virus_count": 0,
                    "job": {
                        "id": "sj82la"
                    },
                    "ready": False,
                    "user": {
                        "id": "test"
                    },
                    "version": 1,
                },
                {
                    "created_at": "2015-10-06T20:00:00Z",
                    "has_files": True,
                    "id": "foo",
                    "modification_count": 0,
                    "modified_virus_count": 0,
                    "job": {
                        "id": "abh675"
                    },
                    "ready": True,
                    "user": {
                        "id": "test"
                    },
                    "version": 0,
                }
            ],
            "total_count": 2,
            "found_count": 2,
            "page": 1,
            "page_count": 1,
            "per_page": 15,
            "modified_virus_count": 0,
            "total_virus_count": 0
        }


class TestGet:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.indexes.insert_one({
            "_id": "foobar",
            "version": 0,
            "created_at": static_time,
            "ready": False,
            "has_files": True,
            "user": {
                "id": "test"
            },
            "job": {
                "id": "sj82la"
            }
        })

        await client.db.history.insert_many([
            {
                "_id": "zxbbvngc.0",
                "kind": {
                    "version": 0,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "zxbbvngc.1",
                "kind": {
                    "version": 1,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "method_name": "add_isolate",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "zxbbvngc.2",
                "kind": {
                    "version": 2,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "method_name": "add_isolate",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "kjs8sa99.3",
                "kind": {
                    "version": 3,
                    "name": "Foo",
                    "id": "kjs8sa99"
                },
                "user": {
                    "id": "fred"
                },
                "method_name": "add_sequence",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "test_1",
                "index": {
                    "id": "baz"
                }

            },
            {
                "_id": "test_2",
                "index": {
                    "id": "baz"
                }
            }
        ])

        resp = await client.get("/api/indexes/foobar")

        assert resp.status == 200

        assert await resp.json() == {
            "created_at": "2015-10-06T20:00:00Z",
            "has_files": True,
            "id": "foobar",
            "version": 0,
            "change_count": 4,
            "kinds": [
                {
                    "id": "kjs8sa99",
                    "name": "Foo",
                    "change_count": 1
                },
                {
                    "id": "zxbbvngc",
                    "name": "Test",
                    "change_count": 3
                }
            ],
            "contributors": [
                {
                    "id": "fred",
                    "count": 1
                },
                {
                    "id": "igboyes",
                    "count": 3
                }
            ],
            "ready": False,
            "job": {
                "id": "sj82la"
            },
            "user": {
                "id": "test"
            }
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/indexes/foobar")

        assert await resp_is.not_found(resp)


class TestCreate:

    async def test(self, mocker, spawn_client, static_time, test_random_alphanumeric):
        client = await spawn_client(authorize=True, permissions=["build_index"], job_manager=True)

        m = mocker.stub(name="new")

        async def mock_new(*args, **kwargs):
            return m(*args, **kwargs)

        mocker.patch.object(client.app["job_manager"], "new", new=mock_new)

        await client.db.indexes.insert_one({
            "_id": "baz",
            "version": 0,
            "ready": True
        })

        await client.db.history.insert_many([
            {
                "_id": "foo.3",
                "index": {
                    "id": "foo",
                    "version": 1
                }
            },
            {
                "_id": "foo.4",
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                }
            },
            {
                "_id": "foo.5",
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                }
            }
        ])

        resp = await client.post("/api/indexes", {})

        assert resp.status == 201

        expected_id = test_random_alphanumeric.history[0]
        expected_job_id = test_random_alphanumeric.history[1]

        assert resp.headers["Location"] == "/api/indexes/{}".format(expected_id)

        # Make sure history is updated to use the build's new index id and version.
        assert 2 == await client.db.history.count({
            "index.id": test_random_alphanumeric.history[0],
            "index.version": 1
        })

        # Make sure a new index document is inserted.
        assert await client.db.indexes.find_one({"version": 1}) == {
            "_id": expected_id,
            "version": 1,
            "created_at": static_time,
            "ready": False,
            "has_files": True,
            "manifest": {},
            "user": {
                "id": "test"
            },
            "job": {
                "id": expected_job_id
            }
        }

        assert await resp.json() == {
            "created_at": "2015-10-06T20:00:00Z",
            "has_files": True,
            "id": expected_id,
            "job": {
                "id": expected_job_id
            },
            "ready": False,
            "manifest": {},
            "user": {
                "id": "test"
            },
            "version": 1,
        }

        # Check that ``job_manager.new`` is called with the expected args and kwargs.
        assert m.call_args[0] == (
            "build_index",
            {
                "index_id": expected_id,
                "index_version": 1,
                "user_id": "test",
                "virus_manifest": {}
            },
            "test"
        )

        assert m.call_args[1] == {
            "job_id": expected_job_id
        }

    async def test_conflict(self, spawn_client, resp_is):
        """
        Test that the request fails with ``409`` when there is already an index build in progress.

        """
        client = await spawn_client(authorize=True, permissions=["build_index"])

        await client.db.indexes.insert_one({
            "_id": "foobar",
            "ready": False
        })

        resp = await client.post("/api/indexes", {})

        assert await resp_is.conflict(resp, message="Index build already in progress")

    async def test_unverified(self, spawn_client, resp_is):
        """
        Test that the request fails with ``400`` when there are unverified kinds included in the build.

        """
        client = await spawn_client(authorize=True, permissions=["build_index"])

        await client.db.kinds.insert_many([
            {
                "_id": "foo",
                "verified": False
            },
            {
                "_id": "bar",
                "verified": True
            }
        ])

        resp = await client.post("/api/indexes", {})

        assert await resp_is.bad_request(resp, message="There are unverified kinds")

    async def test_no_unbuilt(self, spawn_client, resp_is):
        """
        Test that the request fails with ``400`` when there are no unbuilt changes that could be used to build a new
        index.

        """
        client = await spawn_client(authorize=True, permissions=["build_index"])

        await client.db.history.insert_one({
            "_id": "foobar",
            "index": {
                "id": "abc123"
            }
        })

        resp = await client.post("/api/indexes", {})

        assert await resp_is.bad_request(resp, message="There are no unbuilt changes")


class TestFindHistory:

    @pytest.mark.parametrize("identifier", ["foobar", 0])
    async def test(self, identifier, spawn_client):
        client = await spawn_client()

        await client.db.indexes.insert_one({
            "_id": "foobar",
            "version": 0
        })

        await client.db.history.insert_many([
            {
                "_id": "zxbbvngc.0",
                "kind": {
                    "version": 0,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "zxbbvngc.1",
                "kind": {
                    "version": 1,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "method_name": "add_isolate",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "zxbbvngc.2",
                "kind": {
                    "version": 2,
                    "name": "Test",
                    "id": "zxbbvngc"
                },
                "user": {
                    "id": "igboyes"
                },
                "method_name": "add_isolate",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "kjs8sa99.3",
                "kind": {
                    "version": 3,
                    "name": "Foo",
                    "id": "kjs8sa99"
                },
                "user": {
                    "id": "fred"
                },
                "method_name": "add_sequence",
                "index": {
                    "version": 0,
                    "id": "foobar"
                }
            },
            {
                "_id": "test_1",
                "index": {
                    "id": "baz"
                }

            },
            {
                "_id": "test_2",
                "index": {
                    "id": "baz"
                }
            }
        ])

        resp = await client.get("/api/indexes/{}/history".format(identifier))

        assert resp.status == 200

        expected = {
            "found_count": 4,
            "page": 1,
            "page_count": 1,
            "per_page": 15,
            "total_count": 6,
            "documents": [
                {
                    "id": "kjs8sa99.3",
                    "index": {
                        "id": "foobar",
                        "version": 0
                    },
                    "method_name": "add_sequence",
                    "user": {
                        "id": "fred"
                    },
                    "kind": {
                        "id": "kjs8sa99",
                        "name": "Foo",
                        "version": 3
                    }
                },
                {
                    "id": "zxbbvngc.2",
                    "index": {
                        "id": "foobar", "version": 0
                    },
                    "method_name": "add_isolate",
                    "user": {
                        "id": "igboyes"
                    },
                    "kind": {
                        "id": "zxbbvngc",
                        "name": "Test",
                        "version": 2
                    }
                },
                {
                    "id": "zxbbvngc.1",
                    "index": {
                        "id": "foobar", "version": 0
                    },
                    "method_name": "add_isolate",
                    "user": {
                        "id": "igboyes"
                    },
                    "kind": {
                        "id": "zxbbvngc",
                        "name": "Test",
                        "version": 1
                    }
                },
                {
                    "id": "zxbbvngc.0",
                    "index": {
                        "id": "foobar",
                        "version": 0
                    },
                    "user": {
                        "id": "igboyes"
                    },
                    "kind": {
                        "id": "zxbbvngc",
                        "name": "Test",
                        "version": 0
                    }
                }
            ]
        }

        assert await resp.json() == expected

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/indexes/foobar/history")

        assert await resp_is.not_found(resp)
