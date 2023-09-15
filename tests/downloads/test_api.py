import pytest

from tests.fixtures.client import ClientSpawner


@pytest.mark.apitest
@pytest.mark.parametrize("get", ["isolate", "sequence"])
@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_all(get, missing, spawn_client: ClientSpawner):
    client = await spawn_client(authenticated=True)

    isolates = [{"id": "baz", "source_type": "isolate", "source_name": "Baz"}]

    if missing != "isolate":
        isolates.append({"id": "foo", "source_type": "isolate", "source_name": "Foo"})

    if missing != "otu":
        await client.mongo.otus.insert_one(
            {"_id": "foobar", "name": "Foobar virus", "isolates": isolates}
        )

    sequences = [
        {
            "_id": "test_1",
            "otu_id": "foobar",
            "isolate_id": "baz",
            "sequence": "ATAGGGACATA",
        }
    ]

    if missing != "sequence":
        sequences.append(
            {
                "_id": "test_2",
                "otu_id": "foobar",
                "isolate_id": "foo",
                "sequence": "ATAGGGACATA",
            }
        )

    await client.mongo.sequences.insert_many(sequences, session=None)

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
