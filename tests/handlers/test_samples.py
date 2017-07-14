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


class TestListAnalyses:

    async def test(self, test_motor, do_get, static_time):
        await test_motor.samples.insert_one({
            "_id": "test"
        })

        analyses = [
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
                }
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
                }
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
                }
            },
        ]

    async def test_not_found(self, do_get, resp_is):
        resp = await do_get("/api/samples/foobar/analyses")

        assert await resp_is.not_found(resp)
