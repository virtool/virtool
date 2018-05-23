import pytest
from aiohttp.test_utils import make_mocked_coro


async def test_find(mocker, spawn_client, md_proxy):
    client = await spawn_client(authorize=True)

    expected = {
        "documents": [
            {"id": "bar"},
            {"id": "foo"}
        ]
    }

    m_find = mocker.patch("virtool.db.indexes.find", make_mocked_coro(expected))

    resp = await client.get("/api/indexes")

    assert resp.status == 200

    assert await resp.json() == expected

    m_find.assert_called_with(client.db, md_proxy())


@pytest.mark.parametrize("not_found", [False, True])
async def test_get(not_found, mocker, resp_is, spawn_client, static_time):
    client = await spawn_client(authorize=True)

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

    contributors = [
        {
            "id": "fred",
            "count": 1
        },
        {
            "id": "igboyes",
            "count": 3
        }
    ]

    otus = [
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
    ]

    m_get_contributors = mocker.patch("virtool.db.indexes.get_contributors", new=make_mocked_coro(contributors))
    m_get_otus = mocker.patch("virtool.db.indexes.get_otus", new=make_mocked_coro(otus))

    index_id = "baz" if not_found else "foobar"

    resp = await client.get("/api/indexes/" + index_id)

    if not_found:
        assert await resp_is.not_found(resp)

    else:
        m_get_contributors.assert_called_with(client.db, index_id)
        m_get_otus.assert_called_with(client.db, index_id)

        assert resp.status == 200

        assert await resp.json() == {
            "created_at": "2015-10-06T20:00:00Z",
            "has_files": True,
            "id": "foobar",
            "version": 0,
            "change_count": 4,
            "otus": [
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


class TestCreate:

    async def test(self, mocker, spawn_client, static_time, test_random_alphanumeric):
        client = await spawn_client(authorize=True)

        # Insert unbuilt changes to prevent initial check failure.
        await client.db.history.insert_one({
            "index": {
                "id": "unbuilt",
                "version": "unbuilt"
            },
            "reference": {
                "id": "foo"
            }
        })

        # Define mocks.
        m_job_manager = client.app["job_manager"] = mocker.Mock()
        mocker.patch.object(m_job_manager, "close", make_mocked_coro())

        m_new_job = mocker.patch.object(m_job_manager, "new", make_mocked_coro())

        m_get_next_version = mocker.patch("virtool.db.indexes.get_next_version", new=make_mocked_coro(9))

        m_create_manifest = mocker.patch("virtool.db.references.get_manifest", new=make_mocked_coro("manifest"))

        # Make API call.
        resp = await client.post("/api/refs/foo/indexes", {})

        assert resp.status == 201

        expected_id = test_random_alphanumeric.history[1]

        expected_job_id = test_random_alphanumeric.history[2]

        expected = {
            "_id": expected_id,
            "version": 9,
            "created_at": static_time,
            "ready": False,
            "has_files": True,
            "manifest": "manifest",
            "job": {
                "id": expected_job_id
            },
            "reference": {
                "id": "foo"
            },
            "user": {
                "id": "test"
            }
        }

        expected_task_args = {
            "ref_id": "foo",
            "user_id": "test",
            "index_id": expected_id,
            "index_version": 9,
            "manifest": "manifest"
        }

        assert resp.headers["Location"] == "/api/indexes/{}".format(expected_id)

        assert await client.db.indexes.find_one() == expected

        expected["id"] = expected.pop("_id")
        expected["created_at"] = "2015-10-06T20:00:00Z"

        assert await resp.json() == expected

        m_get_next_version.assert_called_with(client.db, "foo")

        m_create_manifest.assert_called_with(client.db, "foo")

        # Check that appropriate mocks were called.
        m_new_job.assert_called_with(
            "build_index",
            expected_task_args,
            "test",
            job_id=expected_job_id
        )

    @pytest.mark.parametrize("error", ["unready", "unverified", "unbuilt"])
    async def test_checks(self, error, resp_is, spawn_client):
        client = await spawn_client(authorize=True)

        if error == "unready":
            await client.db.indexes.insert_one({
                "ready": False,
                "reference": {
                    "id": "foo"
                }
            })

        if error == "unverified":
            await client.db.otus.insert_one({
                "verified": False,
                "reference": {
                    "id": "foo"
                }
            })

        resp = await client.post("/api/refs/foo/indexes", {})

        if error == "unready":
            assert await resp_is.conflict(resp, "Index build already in progress")

        elif error == "unverified":
            assert await resp_is.conflict(resp, "There are unverified otus")

        else:
            assert await resp_is.conflict(resp, "There are no unbuilt changes")



    '''
    async def test(self, mocker, spawn_client, static_time, test_random_alphanumeric):

        

        # Make sure history is updated to use the build's new index id and version.
        assert 2 == await client.db.history.count({
            "index.id": test_random_alphanumeric.history[0],
            "index.version": 1
        })

        # Make sure a new index document is inserted.
        

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
                "otu_manifest": {}
            },
            "test"
        )

        assert m.call_args[1] == {
            "job_id": expected_job_id
        }
    '''


class TestFindHistory:

    @pytest.mark.parametrize("identifier", ["foobar", 0])
    async def test(self, identifier, spawn_client):
        client = await spawn_client(authorize=True)

        await client.db.indexes.insert_one({
            "_id": "foobar",
            "version": 0
        })

        await client.db.history.insert_many([
            {
                "_id": "zxbbvngc.0",
                "otu": {
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
                "otu": {
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
                "otu": {
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
                "otu": {
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
                    "otu": {
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
                    "otu": {
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
                    "otu": {
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
                    "otu": {
                        "id": "zxbbvngc",
                        "name": "Test",
                        "version": 0
                    }
                }
            ]
        }

        assert await resp.json() == expected

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.get("/api/indexes/foobar/history")

        assert await resp_is.not_found(resp)
