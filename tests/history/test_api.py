import pytest
from operator import itemgetter

import virtool.otus.db
import virtool.otus.utils
import virtool.history.utils


async def test_find(snapshot, spawn_client, test_changes, static_time):
    """
    Test that a list of processed change documents are returned with a ``200`` status.

    """
    client = await spawn_client(authorize=True)

    await client.db.history.insert_many(test_changes)

    resp = await client.get("/api/history")

    assert resp.status == 200

    resp_json = await resp.json()

    resp_json["documents"] = sorted(resp_json["documents"], key=itemgetter("id"))

    assert resp_json == {
        "found_count": 3,
        "page": 1,
        "page_count": 1,
        "per_page": 25,
        "total_count": 3,
        "documents": sorted([
            {
                "description": "Edited Prunus virus E",
                "id": "6116cba1.1",
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "edit",
                "created_at": static_time.iso,
                "user": {
                    "id": "test"
                },
                "otu": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "reference": {
                    "id": "hxn167"
                }
            },
            {
                "description": "Edited Prunus virus E",
                "id": "foobar.1",
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "edit",
                "created_at": static_time.iso,
                "user": {
                    "id": "test"
                },
                "otu": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "reference": {
                    "id": "hxn167"
                }
            },
            {
                "description": "Edited Prunus virus E",
                "id": "foobar.2",
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                },
                "method_name": "edit",
                "created_at": static_time.iso,
                "user": {
                    "id": "test"
                },
                "otu": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "reference": {
                    "id": "hxn167"
                }
            }
        ], key=itemgetter("id"))
    }


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, resp_is, spawn_client, test_changes, static_time):
    """
    Test that a specific history change can be retrieved by its change_id.

    """
    client = await spawn_client(authorize=True)

    await client.db.history.insert_many(test_changes)

    change_id = "baz.1" if error else "6116cba1.1"

    resp = await client.get("/api/history/" + change_id)

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "description": "Edited Prunus virus E",
        "diff": [
            ["change", "abbreviation", ["PVF", ""]],
            ["change", "name", ["Prunus virus F", "Prunus virus E"]],
            ["change", "version", [0, 1]]
        ],
        "id": "6116cba1.1",
        "index": {
            "id": "unbuilt",
            "version": "unbuilt"
        },
        "method_name": "edit",
        "created_at": static_time.iso,
        "user": {
            "id": "test"
        },
        "otu": {
            "id": "6116cba1",
            "name": "Prunus virus F",
            "version": 1
        },
        "reference": {
            "id": "hxn167"
        }
    }


@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("remove", [False, True])
async def test_revert(error, remove, create_mock_history, spawn_client, check_ref_right, resp_is):
    """
    Test that a valid request results in a reversion and a ``204`` response.

    """
    client = await spawn_client(authorize=True)

    await create_mock_history(remove)

    change_id = "foo.1" if error else "6116cba1.2"

    resp = await client.delete("/api/history/" + change_id)

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 204

    assert await virtool.otus.db.join(client.db, "6116cba1") == {
        "_id": "6116cba1",
        "abbreviation": "TST",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "sequences": [
                    {
                        "_id": "KX269872",
                        "definition": "Prunus virus F isolate 8816-s2 "
                        "segment RNA2 polyprotein 2 gene, "
                        "complete cds.",
                        "host": "sweet cherry",
                        "isolate_id": "cab8b360",
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "otu_id": "6116cba1",
                        "segment": None
                     }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "reference": {
            "id": "hxn167"
        },
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "name": "Prunus virus F",
        "verified": False,
        "schema": [],
        "version": 1
    }
