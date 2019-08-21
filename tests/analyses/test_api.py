import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("ready", [True, False])
@pytest.mark.parametrize("error", [None, "400", "403", "404"])
async def test_get(ready, error, mocker, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    document = {
        "_id": "foobar",
        "ready": ready,
        "algorithm": "pathoscope_bowtie",
        "results": {},
        "sample": {
            "id": "baz"
        }
    }

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": error != "403",
            "all_write": False,
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "subtraction": {
                "id": "Apple"
            },
            "user": {
                "id": "fred"
            }
        })

    if error != "404":
        await client.db.analyses.insert_one(document)

    m_format_analysis = mocker.patch(
        "virtool.analyses.db.format_analysis",
        make_mocked_coro({
            "_id": "foo",
            "formatted": True
        })
    )

    resp = await client.get("/api/analyses/foobar")

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if ready:
        assert resp.status == 200

        assert await resp.json() == {
            "id": "foo",
            "formatted": True,
            "subtraction": {
                "id": "Apple"
            }
        }

        m_format_analysis.assert_called_with(
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
            "results": {},
            "sample": {
                "id": "baz"
            },
            "subtraction": {
                "id": "Apple"
            }
        }

        assert not m_format_analysis.called


@pytest.mark.parametrize("error", [None, "400", "403", "404", "409"])
async def test_remove(mocker, error, spawn_client, resp_is):

    client = await spawn_client(authorize=True)

    client.app["settings"]["data_path"] = "data"

    if error != "400":
        await client.db.samples.insert_one({
            "_id": "baz",
            "all_read": True,
            "all_write": error != "403",
            "group": "tech",
            "group_read": True,
            "group_write": True,
            "user": {
                "id": "fred"
            }
        })

    if error != "404":
        await client.db.analyses.insert_one({
            "_id": "foobar",
            "ready": error != "409",
            "sample": {
                "id": "baz",
                "name": "Baz"
            },
            "job": {
                "id": "hello"
            }
        })

    m_remove =  mocker.patch("virtool.utils.rm")

    resp = await client.delete("/api/analyses/foobar")

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404":
        assert await resp_is.not_found(resp)
        return

    if error == "409":
        assert await resp_is.conflict(resp, "Analysis is still running")
        return

    assert resp.status == 204

    assert await client.db.analyses.find_one() is None

    assert m_remove.called_with("data/samples/baz/analyses/foobar", True)


@pytest.mark.parametrize("error", [None, "400", "403", "404_analysis", "404_sequence", "409_algorithm", "409_ready"])
async def test_blast(error, mocker, spawn_client, resp_is, static_time):
    """
    Test that the handler starts a BLAST for given NuVs sequence. Also check that it handles all error conditions
    correctly.

    """
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
            ],
            "sample": {
                "id": "baz"
            }
        }

        if error == "404_sequence":
            analysis_document["results"].pop(1)

        elif error == "409_algorithm":
            analysis_document["algorithm"] = "pathoscope_bowtie"

        elif error == "409_ready":
            analysis_document["ready"] = False

        if error != "400":
            await client.db.samples.insert_one({
                "_id": "baz",
                "all_read": True,
                "all_write": error != "403",
                "group": "tech",
                "group_read": True,
                "group_write": True,
                "user": {
                    "id": "fred"
                }
            })

        await client.db.analyses.insert_one(analysis_document)

    m_initialize_ncbi_blast = mocker.patch("virtool.bio.initialize_ncbi_blast", make_mocked_coro(("FOOBAR1337", 23)))

    m_check_rid = mocker.patch("virtool.bio.check_rid", make_mocked_coro(return_value=False))

    m_wait_for_blast_result = mocker.patch("virtool.bio.wait_for_blast_result", make_mocked_coro())

    await client.put("/api/analyses/foobar/5/blast", {})

    resp = await client.put("/api/analyses/foobar/5/blast", {})

    if error == "400":
        assert await resp_is.bad_request(resp, "Parent sample does not exist")
        return

    if error == "403":
        assert await resp_is.insufficient_rights(resp)
        return

    if error == "404_analysis":
        assert await resp_is.not_found(resp, "Analysis not found")
        return

    if error == "404_sequence":
        assert await resp_is.not_found(resp, "Sequence not found")
        return

    if error == "409_algorithm":
        assert await resp_is.conflict(resp, "Not a NuVs analysis")
        return

    if error == "409_ready":
        assert await resp_is.conflict(resp, "Analysis is still running")
        return

    assert resp.status == 201
    assert resp.headers["Location"] == "/api/analyses/foobar/5/blast"

    blast = {
        "rid": "FOOBAR1337",
        "interval": 3,
        "ready": False,
        "last_checked_at": static_time.iso
    }

    assert await resp.json() == blast

    m_initialize_ncbi_blast.assert_called_with(
        client.settings,
        "GGAGTTAGATTGG"
    )

    m_check_rid.assert_called_with(
        client.settings,
        "FOOBAR1337"
    )

    m_wait_for_blast_result.assert_called_with(
        client.db,
        client.settings,
        "foobar",
        5,
        "FOOBAR1337"
    )
