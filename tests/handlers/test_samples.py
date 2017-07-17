import pytest


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
        ("gv", None, None, range(0, 2), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 2,
            "total_count": 3
        }),
        ("sp", None, None, range(2, 3), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 1,
            "total_count": 3
        }),
        ("fred", None, None, range(1, 3), {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 2,
            "total_count": 3
        })
    ])
    async def test(self, term, per_page, page, d_range, meta, test_motor, do_get, static_time):

        await test_motor.samples.insert_many([
            {
                "user": {
                    "id": "bob"
                },
                "nuvs": False,
                "host": "",
                "foobar": True,
                "imported": True,
                "isolate": "Thing",
                "created_at": static_time,
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
                "created_at": static_time,
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
                "created_at": static_time,
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
        
        resp = await do_get(path)

        assert resp.status == 200

        expected_documents = [
            {
                "user": {
                    "id": "bob"
                },
                "nuvs": False,
                "host": "",
                "imported": True,
                "isolate": "Thing",
                "created_at": "2017-10-06T20:00:00Z",
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
            },
            {
                "user": {
                    "id": "fred"
                },
                "nuvs": False,
                "host": "",
                "imported": True,
                "isolate": "",
                "created_at": "2017-10-06T20:00:00Z",
                "archived": False,
                "id": "cb400e6d",
                "name": "16SPP044",
                "pathoscope": False
            }
        ]

        assert await resp.json() == dict(meta, documents=[expected_documents[i] for i in d_range])

    async def test_invalid_query(self, do_get, resp_is):
        resp = await do_get("/api/samples?per_pag=12")

        assert resp.status == 422

        assert await resp_is.invalid_query(resp, {
            "per_pag": ["unknown field"]
        })


class TestGet:

    async def test(self, test_motor, do_get, static_time):
        await test_motor.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        resp = await do_get("api/samples/test")

        assert resp.status == 200

        assert await resp.json() == {
            "id": "test",
            "created_at": "2017-10-06T20:00:00Z",
            "nuvs": False,
            "pathoscope": False
        }

    async def test_not_found(self, do_get, resp_is):
        resp = await do_get("/api/samples/foobar")
        assert await resp_is.not_found(resp)


class TestCreate:

    async def test_already_exists(self, test_motor, do_post, static_time, resp_is):
        await test_motor.samples.insert_one({
            "_id": "foobar",
            "name": "Foobar",
            "created_at": static_time,
            "nuvs": False,
            "pathoscope": False
        })

        resp = await do_post("/api/samples", {
            "name": "Foobar",
            "subtraction": "apple"
        }, authorize=True, permissions=["add_sample"])

        assert await resp_is.conflict(resp, "Sample name 'Foobar' already exists")

    @pytest.mark.parametrize("in_db", [True, False])
    async def test_subtraction_dne(self, in_db, test_motor, do_post, resp_is):
        resp = await do_post("/api/samples", {
            "name": "Foobar",
            "subtraction": "apple"
        }, authorize=True, permissions=["add_sample"])

        if in_db:
            await test_motor.subtraction.insert_one({
                "_id": "apple",
                "is_host": False
            })

        assert await resp_is.not_found(resp, "Subtraction host 'apple' not found")


class TestListAnalyses:

    async def test(self, test_motor, do_get, static_time):
        await test_motor.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        await test_motor.analyses.insert_many([
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

        resp = await do_get("/api/samples/test/analyses")

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

    async def test_not_found(self, do_get, resp_is):
        resp = await do_get("/api/samples/test/analyses")

        assert await resp_is.not_found(resp)


class TestAnalyze:

    async def test(self, mocker, test_motor, do_post, static_time):
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

        await test_motor.samples.insert_one({
            "_id": "test",
            "created_at": static_time
        })

        mocker.patch("virtool.sample_analysis.new", new=mock_new)

        resp = await do_post("/api/samples/test/analyses", data={
            "algorithm": "pathoscope_bowtie"
        }, job_manager=True)

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
            test_motor,
            do_post.server.app["settings"],
            do_post.server.app["job_manager"],
            "test",
            None,
            "pathoscope_bowtie"
        )

    async def test_invalid_input(self, do_post, resp_is):
        resp = await do_post("/api/samples/test/analyses", data={
            "foobar": True
        })

        assert await resp_is.invalid_input(resp, {
            "algorithm": ["required field"], "foobar": ["unknown field"]
        })

    async def test_not_found(self, do_post, resp_is):
        resp = await do_post("/api/samples/test/analyses", data={
            "algorithm": "pathoscope_bowtie"
        })

        assert await resp_is.not_found(resp)
