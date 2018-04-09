import pytest
from operator import itemgetter

import virtool.db.kinds
import virtool.kinds
import virtool.history


class TestFind:

    async def test(self, spawn_client, test_changes):
        """
        Test that a list of processed change documents are returned with a ``200`` status.

        """
        client = await spawn_client()

        await client.db.history.insert_many(test_changes)

        resp = await client.get("/api/history")

        assert resp.status == 200

        resp_json = await resp.json()

        resp_json["documents"] = sorted(resp_json["documents"], key=itemgetter("id"))

        assert resp_json == {
            "found_count": 3,
            "page": 1,
            "page_count": 1,
            "per_page": 15,
            "total_count": 3,
            "documents": sorted([
                {
                    "description": "Edited virus Prunus virus E",
                    "id": "6116cba1.1",
                    "index": {
                        "id": "unbuilt",
                        "version": "unbuilt"
                    },
                    "method_name": "edit",
                    "created_at": "2015-10-06T20:00:00Z",
                    "user": {
                        "id": "test"
                    },
                    "virus": {
                        "id": "6116cba1",
                        "name": "Prunus virus F",
                        "version": 1
                    }
                },
                {
                    "description": "Edited virus Prunus virus E",
                    "id": "foobar.1",
                    "index": {
                        "id": "unbuilt",
                        "version": "unbuilt"
                    },
                    "method_name": "edit",
                    "created_at": "2015-10-06T20:00:00Z",
                    "user": {
                        "id": "test"
                    },
                    "virus": {
                        "id": "6116cba1",
                        "name": "Prunus virus F",
                        "version": 1
                    }
                },
                {
                    "description": "Edited virus Prunus virus E",
                    "id": "foobar.2",
                    "index": {
                        "id": "unbuilt",
                        "version": "unbuilt"
                    },
                    "method_name": "edit",
                    "created_at": "2015-10-06T20:00:00Z",
                    "user": {
                        "id": "test"
                    },
                    "virus": {
                        "id": "6116cba1",
                        "name": "Prunus virus F",
                        "version": 1
                    }
                }
            ], key=itemgetter("id"))
        }


class TestGet:

    async def test(self, spawn_client, test_changes):
        """
        Test that a specific history change can be retrieved by its change_id.

        """
        client = await spawn_client()

        await client.db.history.insert_many(test_changes)

        resp = await client.get("/api/history/6116cba1.1")

        assert resp.status == 200

        assert await resp.json() == {
            "description": "Edited virus Prunus virus E",
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
            "created_at": "2015-10-06T20:00:00Z",
            "user": {
                "id": "test"
            },
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 1
            }
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a specific history change can be retrieved by its change_id.

        """
        client = await spawn_client()

        resp = await client.get("/api/history/foobar.1")

        assert await resp_is.not_found(resp)


class TestRemove:

    @pytest.mark.parametrize("remove", [True, False])
    async def test(self, remove, spawn_client, create_mock_history):
        """
        Test that a valid request results in a reversion and a ``204`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await create_mock_history(remove)

        await client.delete("/api/history/6116cba1.2")

        joined = await virtool.db.kinds.join(client.db, "6116cba1")

        assert joined == {
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
                            "virus_id": "6116cba1",
                            "segment": None
                         }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "name": "Prunus virus F",
            "verified": False,
            "schema": [],
            "version": 1
        }

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a request for a non-existent ``change_id`` results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.delete("/api/history/6116cba1.1")

        assert await resp_is.not_found(resp)
