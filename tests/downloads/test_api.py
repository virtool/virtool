import pytest


@pytest.mark.parametrize("get", ["isolate", "sequence"])
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
@pytest.mark.parametrize("paired", [True, False])
async def test_download_cache_reads(error, paired, spawn_client, resp_is, tmp_path):
    client = await spawn_client(authorize=True)
    client.app["settings"]["data_path"] = tmp_path

    test_dir = tmp_path / "caches" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("reads_1.fq.gz").write_text("test_1")

    cache = {
        "_id": "foo",
        "name": "Foo",
        "files": [
            {
                "name": "reads_1.fq.gz",
                "size": 64591205
            }
        ]
    }

    if paired:
        test_dir.joinpath("reads_2.fq.gz").write_text("test_2")
        cache["files"].append(
            {
                "name": "reads_2.fq.gz",
                "size": 53963680
            }
        )

    if error == "404":
        cache["files"] = None

    await client.db.caches.insert_one(cache)

    resp = await client.get("/download/caches/foo/reads_1.fq.gz")

    if paired:
        resp = await client.get("/download/caches/foo/reads_2.fq.gz")

    if error == "404":
        assert resp.status == 404
        return

    assert resp.status == 200

