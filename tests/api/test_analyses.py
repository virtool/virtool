import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("ready", [True, False], ids=["ready", "unready"])
@pytest.mark.parametrize("not_found", [False, True], ids=["200", "404"])
async def test_get(ready, not_found, mocker, spawn_client):
    client = await spawn_client(authorize=True)

    document = {
        "_id": "foobar",
        "ready": ready,
        "algorithm": "pathoscope_bowtie",
        "results": {}
    }

    if not not_found:
        await client.db.analyses.insert_one(document)

    m = mocker.patch("virtool.db.analyses.format_analysis", new=make_mocked_coro({"_id": "foo", "formatted": True}))

    resp = await client.get("/api/analyses/foobar")

    if not_found:
        assert resp.status == 404

    elif ready:
        assert resp.status == 200

        assert await resp.json() == {
            "id": "foo",
            "formatted": True
        }

        m.assert_called_with(
            client.db,
            client.app["settings"],
            document
        )

    else:
        assert resp.status == 200

        assert await resp.json() == {
            "id": "foobar",
            "ready": False,
            "algorithm": "pathoscope_bowtie",
            "results": {}
        }

        assert not m.called


@pytest.mark.parametrize("has_sample", [True, False], ids=["with_sample", "without_sample"])
@pytest.mark.parametrize("status", [204, 403, 404, 409])
async def test_remove(has_sample, status, mocker, spawn_client, resp_is):

    client = await spawn_client(authorize=True)

    mocker.patch("virtool.samples.get_sample_rights", return_value=(True, status != 403))

    if has_sample:
        sample = {
            "_id": "baz",
            "name": "Baz"
        }

        await client.db.samples.insert_one(sample)

    if status != 404:
        analysis_document = {
            "_id": "foobar",
            "ready": status != 409,
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

    if status == 204 and has_sample:
        assert resp.status == 204
        return

    if status == 404:
        assert await resp_is.not_found(resp)

    elif not has_sample:
        assert await resp_is.not_found(resp, "Sample not found")

    elif status == 403:
        assert await resp_is.insufficient_rights(resp)

    elif status == 409:
        assert await resp_is.conflict(resp, "Analysis is still running")


@pytest.mark.parametrize("error", [None, "404_analysis", "404_sequence", "400_algorithm", "409_ready", "500_index"])
async def test_blast(error, mocker, spawn_client, static_time):
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

        elif error == "409_ready":
            analysis_document["ready"] = False

        elif error == "extra_index":
            analysis_document["results"].append({"index": 5, "sequence": "ATAAGATACACAC"})

        await client.db.analyses.insert_one(analysis_document)

    m_initialize_ncbi_blast = mocker.patch("virtool.bio.initialize_ncbi_blast", make_mocked_coro(("FOOBAR1337", 23)))

    m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(return_value=False))

    m_wait_for_blast_result = mocker.patch("virtool.bio.wait_for_blast_result", make_mocked_coro())

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

    elif error == "409_ready":
        assert await resp.json() == {
            "id": "conflict",
            "message": "Analysis is still running"
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
            "last_checked_at": "2015-10-06T20:00:00Z"
        }

        assert await resp.json() == blast

        assert m_initialize_ncbi_blast.call_args[0] == ({}, "GGAGTTAGATTGG")
        assert m_check_rid.call_args[0] == ({}, "FOOBAR1337")

        m_wait_for_blast_result.assert_called_with(
            client.db,
            {},
            "foobar",
            5,
            "FOOBAR1337"
        )
