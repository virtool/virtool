import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro


class TestFind:
    @pytest.mark.parametrize("term,per_page,page,d_range,meta", [
        (None, None, None, range(0, 3), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 3,
            "total_count": 3
        }),
        # Test ``per_page`` query param.
        (None, 2, 1, range(0, 2), {
            "page": 1,
            "per_page": 2,
            "page_count": 2,
            "found_count": 3,
            "total_count": 3
        }),
        # Test ``per_page`` and ``page`` query param.
        (None, 2, 2, range(2, 3), {
            "page": 2,
            "per_page": 2,
            "page_count": 2,
            "found_count": 3,
            "total_count": 3
        }),
        # Test ``term`` query param and ``found_count`` response field.
        ("gv", None, None, range(1, 3), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 2,
            "total_count": 3
        }),
        ("sp", None, None, range(0, 1), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 1,
            "total_count": 3
        }),
        ("fred", None, None, [0, 2], {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 2,
            "total_count": 3
        })
    ])
    async def test(self, term, per_page, page, d_range, meta, spawn_client, static_time):
        client = await spawn_client()

        time_1 = arrow.get(static_time).datetime
        time_2 = arrow.get(static_time).shift(hours=1).datetime
        time_3 = arrow.get(static_time).shift(hours=2).datetime

        await client.db.samples.insert_many([
            {
                "user": {
                    "id": "bob"
                },
                "nuvs": False,
                "host": "",
                "foobar": True,
                "imported": True,
                "isolate": "Thing",
                "created_at": time_2,
                "archived": True,
                "_id": "beb1eb10",
                "name": "16GVP042",
                "pathoscope": False
            },
            {
                "user": {
                    "id": "fred"
                },
                "nuvs": False,
                "host": "",
                "foobar": True,
                "imported": True,
                "isolate": "Test",
                "created_at": time_1,
                "archived": True,
                "_id": "72bb8b31",
                "name": "16GVP043",
                "pathoscope": False
            },
            {
                "user": {
                    "id": "fred"
                },
                "nuvs": False,
                "host": "",
                "foobar": True,
                "imported": True,
                "isolate": "",
                "created_at": time_3,
                "archived": False,
                "_id": "cb400e6d",
                "name": "16SPP044",
                "pathoscope": False
            }
        ])

        path = "/api/samples"
        query = list()

        if term is not None:
            query.append("term={}".format(term))

        if per_page is not None:
            query.append("per_page={}".format(per_page))

        if page is not None:
            query.append("page={}".format(page))

        if len(query):
            path += "?{}".format("&".join(query))

        resp = await client.get(path)

        assert resp.status == 200

        expected_documents = [
            {
                "user": {
                    "id": "fred"
                },
                "nuvs": False,
                "host": "",
                "imported": True,
                "isolate": "",
                "created_at": "2017-10-06T22:00:00Z",
                "archived": False,
                "id": "cb400e6d",
                "name": "16SPP044",
                "pathoscope": False
            },
            {
                "user": {
                    "id": "bob"
                },
                "nuvs": False,
                "host": "",
                "imported": True,
                "isolate": "Thing",
                "created_at": "2017-10-06T21:00:00Z",
                "archived": True,
                "id": "beb1eb10",
                "name": "16GVP042",
                "pathoscope": False
            },
            {
                "user": {
                    "id": "fred"
                },
                "nuvs": False,
                "host": "",
                "imported": True,
                "isolate": "Test",
                "created_at": "2017-10-06T20:00:00Z",
                "archived": True,
                "id": "72bb8b31",
                "name": "16GVP043",
                "pathoscope": False
            }
        ]

        assert await resp.json() == dict(meta, documents=[expected_documents[i] for i in d_range])

    async def test_invalid_query(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/samples?per_pag=12")

        assert resp.status == 422

        assert await resp_is.invalid_query(resp, {
            "per_pag": ["unknown field"]
        })


class TestGet:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        resp = await client.get("api/samples/test")

        assert resp.status == 200

        assert await resp.json() == {
            "id": "test",
            "created_at": "2017-10-06T20:00:00Z"
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/samples/foobar")
        assert await resp_is.not_found(resp)


class TestCreate:

    @pytest.mark.parametrize("group_setting", ["none", "users_primary_group", "force_choice"])
    async def test(self, group_setting, monkeypatch, spawn_client, test_motor, static_time, test_random_alphanumeric):
        client = await spawn_client(authorize=True, permissions=["create_sample"], job_manager=True)

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        await client.db.files.insert_one({
            "_id": "test.fq"
        })

        await client.db.groups.insert_many([
            {"_id": "diagnostics"},
            {"_id": "technician"}
        ])

        client.app["settings"].set("sample_group", group_setting)

        m_reserve = make_mocked_coro()
        monkeypatch.setattr("virtool.file.reserve", m_reserve)

        m_new = make_mocked_coro()
        monkeypatch.setattr(client.app["job_manager"], "new", m_new)

        request_data = {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple"
        }

        if group_setting == "force_choice":
            request_data["group"] = "diagnostics"

        resp = await client.post("/api/samples", request_data)

        assert resp.status == 200

        expected_group = "none"

        if group_setting == "users_primary_group":
            expected_group = "technician"

        if group_setting == "force_choice":
            expected_group = "diagnostics"

        expected = {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": {
                "id": "apple"
            },
            "group": expected_group,
            "nuvs": False,
            "pathoscope": False,
            "created_at": "2017-10-06T20:00:00Z",
            "format": "fastq",
            "imported": "ip",
            "quality": None,
            "analyzed": False,
            "hold": True,
            "archived": False,
            "group_read": True,
            "group_write": False,
            "all_read": True,
            "all_write": False,
            "user": {
                "id": "test"
            },
            "id": test_random_alphanumeric.last_choice
        }

        assert await resp.json() == expected

        expected.update({
            "_id": expected.pop("id"),
            "created_at": static_time
        })

        assert await test_motor.samples.find_one() == expected

        # Check call to file.reserve.
        assert m_reserve.call_args[0] == (
            test_motor,
            ["test.fq"]
        )

        # Check call to job_manager.new.
        assert m_new.call_args[0] == (
            "create_sample",
            {
                "files": ["test.fq"],
                "sample_id": test_random_alphanumeric.last_choice
            },
            "test"
        )

    async def test_name_exists(self, spawn_client, static_time, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        await client.db.samples.insert_one({
            "_id": "foobar",
            "name": "Foobar",
            "lower_name": "foobar",
            "created_at": static_time,
            "nuvs": False,
            "pathoscope": False
        })

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple"
        })

        assert await resp_is.conflict(resp, "Sample name 'Foobar' already exists")

    async def test_force_choice(self, spawn_client, static_time, resp_is):
        """
        Test that when ``force_choice`` is enabled, a request with no group field passed results in an error.
        response.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"].set("sample_group", "force_choice")

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple"
        })

        assert await resp_is.bad_request(resp, "Server requires a 'group' field for sample creation")

    async def test_group_dne(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"].set("sample_group", "force_choice")

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple",
            "group": "foobar"
        })

        assert await resp_is.not_found(resp, "Group 'foobar' not found")

    @pytest.mark.parametrize("in_db", [True, False])
    async def test_subtraction_dne(self, in_db, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple"
        })

        if in_db:
            await client.db.subtraction.insert_one({
                "_id": "apple",
                "is_host": False
            })

        assert await resp_is.not_found(resp, "Subtraction host 'apple' not found")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(self, one_exists, spawn_client, resp_is):
        """
        Test that a ``404`` is returned if one or more of the file ids passed in ``files`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        if one_exists:
            await client.db.files.insert_one({
                "_id": "test.fq"
            })

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq", "baz.fq"],
            "subtraction": "apple"
        })

        assert await resp_is.not_found(resp, "One or more of the passed file ids do(es) not exist")


class TestRemove:

    @pytest.mark.parametrize("delete_result,resp_is_attr", [(1, "no_content"), (0, "not_found")])
    async def test(self, delete_result, resp_is_attr, mocker, spawn_client, resp_is, create_delete_result):
        client = await spawn_client(authorize=True)

        m = mocker.stub(name="remove_samples")

        async def mock_remove_samples(*args, **kwargs):
            m(*args, **kwargs)
            return create_delete_result(delete_result)

        mocker.patch("virtool.sample.remove_samples", new=mock_remove_samples)

        resp = await client.delete("/api/samples/foobar")

        assert m.call_args[0] == (client.db, client.app["settings"], ["foobar"])

        assert await getattr(resp_is, resp_is_attr)(resp)


class TestListAnalyses:

    async def test(self, spawn_client, static_time):
        client = await spawn_client()

        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        await client.db.analyses.insert_many([
            {
                "_id": "test_1",
                "algorithm": "pathopscope_bowtie",
                "created_at": static_time,
                "ready": True,
                "job": {
                    "id": "test"
                },
                "index": {
                    "version": 2,
                    "id": "foo"
                },
                "user": {
                    "id": "fred"
                },
                "sample": {
                    "id": "test"
                },
                "foobar": True
            },
            {
                "_id": "test_2",
                "algorithm": "pathopscope_bowtie",
                "created_at": static_time,
                "ready": True,
                "job": {
                    "id": "test"
                },
                "index": {
                    "version": 2,
                    "id": "foo"
                },
                "user": {
                    "id": "fred"
                },
                "sample": {
                    "id": "test"
                },
                "foobar": True
            },
            {
                "_id": "test_3",
                "algorithm": "pathopscope_bowtie",
                "created_at": static_time,
                "ready": True,
                "job": {
                    "id": "test"
                },
                "index": {
                    "version": 2,
                    "id": "foo"
                },
                "user": {
                    "id": "fred"
                },
                "sample": {
                    "id": "test"
                },
                "foobar": False
            },
        ])

        resp = await client.get("/api/samples/test/analyses")

        assert resp.status == 200

        assert await resp.json() == {
            "total_count": 3,
            "documents": [
                {
                    "id": "test_1",
                    "algorithm": "pathopscope_bowtie",
                    "created_at": "2017-10-06T20:00:00Z",
                    "ready": True,
                    "job": {
                        "id": "test"
                    },
                    "index": {
                        "version": 2,
                        "id": "foo"
                    },
                    "user": {
                        "id": "fred"
                    },
                    "sample": {
                        "id": "test"
                    }
                },
                {
                    "id": "test_2",
                    "algorithm": "pathopscope_bowtie",
                    "created_at": "2017-10-06T20:00:00Z",
                    "ready": True,
                    "job": {
                        "id": "test"
                    },
                    "index": {
                        "version": 2,
                        "id": "foo"
                    },
                    "user": {
                        "id": "fred"
                    },
                    "sample": {
                        "id": "test"
                    }
                },
                {
                    "id": "test_3",
                    "algorithm": "pathopscope_bowtie",
                    "created_at": "2017-10-06T20:00:00Z",
                    "ready": True,
                    "job": {
                        "id": "test"
                    },
                    "index": {
                        "version": 2,
                        "id": "foo"
                    },
                    "user": {
                        "id": "fred"
                    },
                    "sample": {
                        "id": "test"
                    }
                }
            ]
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get("/api/samples/test/analyses")

        assert await resp_is.not_found(resp)


class TestAnalyze:

    async def test(self, mocker, spawn_client, static_time):
        client = await spawn_client(job_manager=True)

        m = mocker.Mock(return_value={
            "_id": "test_analysis",
            "ready": False,
            "created_at": static_time,
            "job": {
                "id": "baz"
            },
            "algorithm": "pathoscope_bowtie",
            "sample": {
                "id": "test"
            },
            "index": {
                "id": "foobar",
                "version": 3
            },
            "user": {
                "id": "test",
            }
        })

        async def mock_new(*args, **kwargs):
            return m(*args, **kwargs)

        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        mocker.patch("virtool.sample_analysis.new", new=mock_new)

        resp = await client.post("/api/samples/test/analyses", data={
            "algorithm": "pathoscope_bowtie"
        })

        assert resp.status == 201

        assert resp.headers.get("Location") == "/api/analyses/test_analysis"

        assert await resp.json() == {
            "id": "test_analysis",
            "ready": False,
            "algorithm": "pathoscope_bowtie",
            "created_at": "2017-10-06T20:00:00Z",
            "sample": {
                "id": "test"
            },
            "index": {
                "id": "foobar",
                "version": 3
            },

            "user": {
                "id": "test"
            },

            "job": {
                "id": "baz"
            }
        }

        assert m.call_args[0] == (
            client.db,
            client.app["settings"],
            client.app["job_manager"],
            "test",
            None,
            "pathoscope_bowtie"
        )

    async def test_invalid_input(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.post("/api/samples/test/analyses", data={
            "foobar": True
        })

        assert await resp_is.invalid_input(resp, {
            "algorithm": ["required field"], "foobar": ["unknown field"]
        })

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.post("/api/samples/test/analyses", data={
            "algorithm": "pathoscope_bowtie"
        })

        assert await resp_is.not_found(resp)
