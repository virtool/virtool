import pytest
from copy import deepcopy
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("not_found", [False, True], ids=["200", "404"])
async def test_get(mocker, not_found, spawn_client):
    client = await spawn_client(authorize=True)

    document = {
        "_id": "foobar",
        "formatted": False
    }

    if not not_found:
        await client.db.analyses.insert_one(document)

    m = mocker.stub(name="format_analysis")

    return_value = dict(document, formatted=True)

    async def format_analysis(db, document):
        m(db, document)
        return return_value

    mocker.patch("virtool.sample_analysis.format_analysis", new=format_analysis)

    resp = await client.get("/api/analyses/foobar")

    if not_found:
        assert resp.status == 404
    else:
        assert resp.status == 200

        assert await resp.json() == {
            "id": "foobar",
            "formatted": True
        }

        assert m.call_args[0] == (
            client.db,
            document
        )


@pytest.mark.parametrize("has_sample", [True, False], ids=["with_sample", "without_sample"])
@pytest.mark.parametrize("status", [204, 404, 409])
async def test_remove(has_sample, status, spawn_client, resp_is, test_dispatch):
    client = await spawn_client(authorize=True)

    if has_sample:
        await client.db.samples.insert_one({
            "_id": "baz",
            "name": "Baz"
        })

    if status != 404:
        analysis_document = {
            "_id": "foobar",
            "ready": status == 204,
            "sample": {
                "id": "baz",
                "name": "Baz"
            },
            "job": {
                "id": "hello"
            }
        }

        await client.db.analyses.insert_one(analysis_document)

    resp = await client.delete("/api/analyses/foobar")

    assert resp.status == status

    if status == 409:
        assert await resp_is.conflict(resp, "Analysis is still running. Cancel job 'hello' instead")

    elif status == 404:
        assert await resp_is.not_found(resp)

    else:
        if has_sample:
            assert test_dispatch.stub.call_args[0] == (
                "samples",
                "update",
                {
                    "id": "baz",
                    "name": "Baz"
                }
            )
        else:
            assert not test_dispatch.stub.called


@pytest.mark.parametrize("error", [None, "404_analysis", "404_sequence", "400_algorithm", "400_ready", "500_index"])
async def test_blast(error, mocker, spawn_client, test_dispatch, static_time):
    client = await spawn_client(authorize=True)

    if error != "404_analysis":
        analysis_document = {
            "_id": "foobar",
            "algorithm": "nuvs",
            "ready": True,
            "results": [
                {"index": 3, "sequence": "ATAGAGATTAGAT"},
                {"index": 5, "sequence": "GGAGTTAGATTGG"},
                {"index": 8, "sequence": "ACCAATAGACATT"}
            ]
        }

        if error == "404_sequence":
            analysis_document["results"].pop(1)

        elif error == "400_algorithm":
            analysis_document["algorithm"] = "pathoscope_bowtie"

        elif error == "400_ready":
            analysis_document["ready"] = False

        elif error == "extra_index":
            analysis_document["results"].append({"index": 5, "sequence": "ATAAGATACACAC"})

        await client.db.analyses.insert_one(analysis_document)

    m_format_analysis = make_mocked_coro(return_value={
        "_id": "foobar",
        "algorithm": "nuvs",
        "ready": True,
        "results": [
            {"index": 3, "sequence": "ATAGAGATTAGAT"},
            {"index": 5, "sequence": "GGAGTTAGATTGG"},
            {"index": 8, "sequence": "ACCAATAGACATT"}
        ]
    })

    mocker.patch("virtool.sample_analysis.format_analysis", new=m_format_analysis)

    # Do a bunch of mocking in virtool.bio module.
    m_initialize_ncbi_blast = make_mocked_coro(return_value=("FOOBAR1337", 23))
    mocker.patch("virtool.bio.initialize_ncbi_blast", new=m_initialize_ncbi_blast)

    m_check_rid = make_mocked_coro(return_value=False)
    mocker.patch("virtool.bio.check_rid", new=m_check_rid)

    stub = mocker.stub(name="wait_for_blast_result")

    # Use this func to make sure that wait_for_blast_result() is awaited.
    async def nothing():
        pass

    async def wait_for_blast_result(*args, **kwargs):
        await nothing()
        return stub(*args, **kwargs)

    mocker.patch("virtool.bio.wait_for_blast_result", new=wait_for_blast_result)

    await client.put("/api/analyses/foobar/5/blast", {})

    resp = await client.put("/api/analyses/foobar/5/blast", {})

    assert resp.status == 200 if not error else int(error.split("_")[0])

    if not error:
        assert resp.headers["Location"] == "/api/analyses/foobar/5/blast"

    if error == "404_analysis":
        assert await resp.json() == {
            "id": "not_found",
            "message": "Analysis not found"
        }

    elif error == "404_sequence":
        assert await resp.json() == {
            "id": "not_found",
            "message": "Sequence not found"
        }

    elif error == "400_algorithm":
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Not a NuVs analysis"
        }

    elif error == "400_ready":
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Still in progress"
        }

    elif error == "extra_index":
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Still in progress"
        }

    elif error is None:
        blast = {
            "rid": "FOOBAR1337",
            "interval": 3,
            "ready": False,
            "last_checked_at": "2017-10-06T20:00:00Z"
        }

        assert await resp.json() == blast

        assert m_initialize_ncbi_blast.call_args[0] == ("GGAGTTAGATTGG",)
        assert m_check_rid.call_args[0] == ("FOOBAR1337",)

        expected_format_arg = deepcopy(analysis_document)
        expected_format_arg["results"][1]["blast"] = dict(blast, last_checked_at= static_time)

        assert m_format_analysis.call_args[0] == (
            client.db,
            expected_format_arg
        )

        # Checking that the mock return value from m_format_analysis is passed to dispatch.
        assert test_dispatch.stub.call_args[0] == (
            "analyses",
            "update",
            {
                "id": "foobar",
                "algorithm": "nuvs",
                "ready": True,
                "results": [
                    {"index": 3, "sequence": "ATAGAGATTAGAT"},
                    {"index": 5, "sequence": "GGAGTTAGATTGG"},
                    {"index": 8, "sequence": "ACCAATAGACATT"}
                ]
            }
        )

        assert stub.call_args[0] == (
            client.db,
            test_dispatch,
            "foobar",
            5,
            "FOOBAR1337"
        )
