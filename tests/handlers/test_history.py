import pytest
from copy import deepcopy
from operator import itemgetter

import virtool.virus
import virtool.virus_history


class TestFind:

    async def test(self, test_db, do_get, test_changes):
        """
        Test that a list of processed change documents are returned with a ``200`` status.
         
        """
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history")

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
                    "created_at": "2017-10-06T20:00:00Z",
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
                    "created_at": "2017-10-06T20:00:00Z",
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
                    "created_at": "2017-10-06T20:00:00Z",
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

    async def test(self, test_db, do_get, test_changes):
        """
        Test that a specific history change can be retrieved by its change_id.
         
        """
        test_db.history.insert_many(test_changes)

        resp = await do_get("/api/history/6116cba1.1")

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
            "created_at": "2017-10-06T20:00:00Z",
            "user": {
                "id": "test"
            },
            "virus": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 1
            }
        }

    async def test_not_found(self, do_get):
        """
        Test that a specific history change can be retrieved by its change_id.

        """
        resp = await do_get("/api/history/foobar.1")

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found"
        }


class TestRemove:

    @pytest.mark.parametrize("remove", [True, False])
    async def test(self, remove, test_motor, do_delete, test_merged_virus):
        """
        Test that a valid request results in a reversion and a ``204`` response.
         
        """
        # Apply a series of changes to a test virus document to build up a history.
        await virtool.virus_history.add(test_motor, "create", None, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "abbreviation": "TST",
            "version": 1
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        # We will try to patch to this version of the joined virus.
        expected = deepcopy(old)

        test_merged_virus.update({
            "name": "Test Virus",
            "version": 2
        })

        await virtool.virus_history.add(test_motor, "update", old, test_merged_virus, "Description", "test")

        old = deepcopy(test_merged_virus)

        test_merged_virus.update({
            "isolates": [],
            "version": 3
        })

        await virtool.virus_history.add(test_motor, "remove_isolate", old, test_merged_virus, "Description", "test")

        if remove:
            old = deepcopy(test_merged_virus)

            test_merged_virus = {
                "_id": "6116cba1"
            }

            await virtool.virus_history.add(test_motor, "remove", old, test_merged_virus, "Description", "test")
        else:
            virus, sequences = virtool.virus.split_virus(test_merged_virus)
            await test_motor.viruses.insert_one(virus)

        await do_delete("/api/history/6116cba1.2")

        joined = await virtool.virus.join(test_motor, expected["_id"])

        assert joined == expected

    async def test_not_found(self, do_delete):
        """
        Test that a request for a non-existent ``change_id`` results in a ``404`` response.
         
        """
        resp = await do_delete("/api/history/6116cba1.1")

        assert resp.status == 404

        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found"
        }
