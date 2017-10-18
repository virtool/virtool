import pytest


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

    sample_document = None

    if has_sample:
        sample_document = {
            "_id": "baz",
            "name": "Baz"
        }

        await client.db.samples.insert_one(sample_document)

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

