import pytest


@pytest.mark.parametrize("get", ["otu", "isolate", "sequence"])
@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_all(get, missing, spawn_client):
    client = await spawn_client(authorize=True)

    isolates = [{
        "id": "baz",
        "source_type": "isolate",
        "source_name": "Baz"
    }]

    if missing != "isolate":
        isolates.append({
            "id": "foo",
            "source_type": "isolate",
            "source_name": "Foo"
        })

    if missing != "otu":
        await client.db.otus.insert_one({
            "_id": "foobar",
            "name": "Foobar virus",
            "isolates": isolates
        })

    sequences = [{
        "_id": "test_1",
        "otu_id": "foobar",
        "isolate_id": "baz",
        "sequence": "ATAGGGACATA"
    }]

    if missing != "sequence":
        sequences.append({
            "_id": "test_2",
            "otu_id": "foobar",
            "isolate_id": "foo",
            "sequence": "ATAGGGACATA"
        })

    await client.db.sequences.insert_many(sequences)

    url = "/download/otus/foobar"

    if get == "isolate":
        url += "/isolates/foo"

    if get == "sequence":
        url = "/download/sequences/test_2"

    resp = await client.get(url)

    get_isolate_error = get == "isolate" and missing == "otu"
    get_sequence_error = get == "sequence" and missing in ["otu", "isolate"]

    if get == missing or get_isolate_error or get_sequence_error:
        assert resp.status == 404
    else:
        assert resp.status == 200


@pytest.mark.parametrize("error", [None, "404"])
async def test_download_subtraction(error, tmpdir, spawn_client, resp_is):
    client = await spawn_client(authorize=True)

    client.app["settings"]["data_path"] = str(tmpdir)

    tmpdir.mkdir("subtractions").mkdir("foo").join("subtraction.fa.gz").write("test")

    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "has_file": True
    }

    if error == "404":
        subtraction["has_file"] = False

    await client.db.subtraction.insert_one(subtraction)

    resp = await client.get("/download/subtraction/foo")

    if error == "404":
        assert resp.status == 404
        return

    assert resp.status == 200
