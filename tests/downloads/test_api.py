import shutil
from pathlib import Path

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
