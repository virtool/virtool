import arrow
import pytest
from aiohttp.test_utils import make_mocked_coro


class TestFind:
    @pytest.mark.parametrize("find,per_page,page,d_range,meta", [
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
        # Test ``find`` query param and ``found_count`` response field.
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
    async def test(self, find, per_page, page, d_range, meta, spawn_client, static_time):
        client = await spawn_client(authorize=True)

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
                "pathoscope": False,
                "all_read": True
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
                "pathoscope": False,
                "all_read": True
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
                "pathoscope": False,
                "all_read": True
            }
        ])

        path = "/api/samples"
        query = list()

        if find is not None:
            query.append("find={}".format(find))

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
                "created_at": "2015-10-06T22:00:00Z",
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
                "created_at": "2015-10-06T21:00:00Z",
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
                "created_at": "2015-10-06T20:00:00Z",
                "archived": True,
                "id": "72bb8b31",
                "name": "16GVP043",
                "pathoscope": False
            }
        ]

        assert await resp.json() == dict(meta, documents=[expected_documents[i] for i in d_range])

    async def test_invalid_query(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.get("/api/samples?per_page=five")

        assert resp.status == 422

        assert await resp_is.invalid_query(resp, {
                'per_page': [
                    "field 'per_page' cannot be coerced: invalid literal for int() with base 10: 'five'",
                    'must be of integer type'
                ]
        })


class TestGet:

    async def test(self, mocker, spawn_client, static_time):
        mocker.patch("virtool.samples.get_sample_rights", return_value=(True, True))

        client = await spawn_client(authorize=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        resp = await client.get("api/samples/test")

        assert resp.status == 200

        assert await resp.json() == {
            "id": "test",
            "created_at": "2015-10-06T20:00:00Z"
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.get("/api/samples/foobar")
        assert await resp_is.not_found(resp)


class TestCreate:

    @pytest.mark.parametrize("group_setting", ["none", "users_primary_group", "force_choice"])
    async def test(self, group_setting, mocker, spawn_client, static_time,
                   test_random_alphanumeric):

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

        client.app["settings"].update({
            "sample_group": group_setting,
            "sample_all_read": True,
            "sample_all_write": True,
            "sample_group_read": True,
            "sample_group_write": True,
            "sample_unique_names": True
        })

        m_reserve = mocker.patch("virtool.db.files.reserve", make_mocked_coro())

        m_new = mocker.patch.object(client.app["job_manager"], "new", make_mocked_coro())

        request_data = {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple",
        }

        if group_setting == "force_choice":
            request_data["group"] = "diagnostics"

        resp = await client.post("/api/samples", request_data)

        assert resp.status == 201

        assert resp.headers["Location"] == "/api/samples/" + test_random_alphanumeric.last_choice

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
            "created_at": "2015-10-06T20:00:00Z",
            "format": "fastq",
            "imported": "ip",
            "quality": None,
            "analyzed": False,
            "hold": True,
            "archived": False,
            "group_read": True,
            "group_write": True,
            "all_read": True,
            "all_write": True,
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

        assert await client.db.samples.find_one() == expected

        # Check call to file.reserve.
        assert m_reserve.call_args[0] == (
            client.db,
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

        client.app["settings"]["sample_unique_names"] = True

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

        assert await resp_is.conflict(resp, "Sample name is already in use")

    async def test_force_choice(self, mocker, spawn_client, static_time, resp_is):
        """
        Test that when ``force_choice`` is enabled, a request with no group field passed results in an error.
        response.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_group"] = "force_choice"
        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        mocker.patch("virtool.db.utils.ids_exist", new=make_mocked_coro(True))

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple"
        })

        assert await resp_is.bad_request(resp, "Server requires a 'group' field for sample creation")

    async def test_group_dne(self, mocker, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_group"] = "force_choice"
        client.app["settings"]["sample_unique_names"] = True

        await client.db.subtraction.insert_one({
            "_id": "apple",
            "is_host": True
        })

        mocker.patch("virtool.db.utils.ids_exist", new=make_mocked_coro(True))

        resp = await client.post("/api/samples", {
            "name": "Foobar",
            "files": ["test.fq"],
            "subtraction": "apple",
            "group": "foobar"
        })

        assert await resp_is.not_found(resp, "Group not found")

    @pytest.mark.parametrize("in_db", [True, False])
    async def test_subtraction_dne(self, in_db, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

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

        assert await resp_is.not_found(resp, "Subtraction not found")

    @pytest.mark.parametrize("one_exists", [True, False])
    async def test_file_dne(self, one_exists, spawn_client, resp_is):
        """
        Test that a ``404`` is returned if one or more of the file ids passed in ``files`` does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["create_sample"])

        client.app["settings"]["sample_unique_names"] = True

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

        assert await resp_is.not_found(resp, "File id does not exist")


class TestRemove:

    @pytest.mark.parametrize("delete_result,resp_is_attr", [(1, "no_content"), (0, "not_found")])
    async def test(self, delete_result, resp_is_attr, mocker, spawn_client, resp_is, create_delete_result):
        client = await spawn_client(authorize=True)

        mocker.patch("virtool.samples.get_sample_rights", return_value=(True, True))

        if resp_is_attr == "no_content":
            await client.db.samples.insert_one({
                "_id": "test",
                "all_read": True,
                "all_write": True
            })

        m = mocker.stub(name="remove_samples")

        async def mock_remove_samples(*args, **kwargs):
            m(*args, **kwargs)
            return create_delete_result(delete_result)

        mocker.patch("virtool.db.samples.remove_samples", new=mock_remove_samples)

        resp = await client.delete("/api/samples/test")

        assert await getattr(resp_is, resp_is_attr)(resp)

        if resp_is_attr == "no_content":
            m.assert_called_with(client.db, client.app["settings"], ["test"])
        else:
            assert not m.called


class TestListAnalyses:

    async def test(self, mocker, spawn_client, static_time):

        mocker.patch("virtool.samples.get_sample_rights", return_value=(True, True))

        client = await spawn_client(authorize=True)

        await client.db.samples.insert_one({
            "_id": "test",
            "created_at": static_time,
            "all_read": True,
            "all_write": True
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
                    "created_at": "2015-10-06T20:00:00Z",
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
                    "created_at": "2015-10-06T20:00:00Z",
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
                    "created_at": "2015-10-06T20:00:00Z",
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
        client = await spawn_client(authorize=True)

        resp = await client.get("/api/samples/test/analyses")

        assert await resp_is.not_found(resp)


class TestAnalyze:

    @pytest.mark.parametrize("error", [None, "sample", "no_index", "no_ready_index"])
    async def test(self, error, mocker, spawn_client, static_time, resp_is):
        mocker.patch("virtool.samples.get_sample_rights", return_value=(True, True))

        client = await spawn_client(authorize=True, job_manager=True)

        test_analysis = {
            "id": "test_analysis",
            "ready": False,
            "created_at": "'2015-10-06T20:00:00Z'",
            "job": {
                "id": "baz"
            },
            "algorithm": "pathoscope_bowtie",
            "ref": {
                "id": "foo"
            },
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
        }

        if error != "sample":
            await client.db.samples.insert_one({
                "_id": "test",
                "created_at": static_time,
                "all_read": True,
                "all_write": True
            })

        if error != "no_index":
            await client.db.indexes.insert_one({
                "_id": "test",
                "ref": {
                    "id": "foo"
                },
                "ready": error != "no_ready_index"
            })

        m_new = mocker.patch("virtool.db.analyses.new", new=make_mocked_coro(test_analysis))

        resp = await client.post("/api/samples/test/analyses", data={
            "algorithm": "pathoscope_bowtie",
            "ref_id": "foo"
        })

        if error is None:
            assert resp.status == 201

            assert resp.headers["Location"] == "/api/analyses/test_analysis"

            assert await resp.json() == test_analysis

            m_new.assert_called_with(
                client.db,
                client.app["job_manager"],
                "test",
                "foo",
                "test",
                "pathoscope_bowtie"
            )

        elif error == "sample":
            assert await resp_is.not_found(resp)

        else:
            assert await resp_is.not_found(resp, "Ready index not found")

    async def test_invalid_input(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True)

        resp = await client.post("/api/samples/test/analyses", data={
            "foobar": True
        })

        assert await resp_is.invalid_input(resp, {
            "algorithm": ["required field"], "foobar": ["unknown field"], "ref_id": ["required field"]
        })
