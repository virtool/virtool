import os
import pytest

from copy import deepcopy

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files")


class TestFind:

    async def test(self, test_db, do_get):
        test_db.viruses.insert_many([
            {
                "abbreviation": "TyV_GV1 (not confirmed)",
                "modified": False,
                "name": "Tymovirus from Grapevine 1(not confirmed)",
                "_id": "2f97f077"
            },
            {
                "abbreviation": "PVF",
                "modified": False,
                "name": "Prunus virus F",
                "_id": "6116cba1"
            },
            {
                "abbreviation": "EV_TF3-mycovirus",
                "modified": False,
                "name": "Endornavirus of Tree Fruit #3",
                "_id": "5350af44"
            }
        ])

        resp = await do_get("/api/viruses")

        assert resp.status == 200

        assert await resp.json() == {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 3,
            "total_count": 3,
            "modified_count": 0,
            "documents": [
                {
                    "abbreviation": "EV_TF3-mycovirus",
                    "modified": False,
                    "name": "Endornavirus of Tree Fruit #3",
                    "id": "5350af44"
                },
                {
                    "abbreviation": "PVF",
                    "modified": False,
                    "name": "Prunus virus F",
                    "id": "6116cba1"
                },
                {
                    "abbreviation": "TyV_GV1 (not confirmed)",
                    "modified": False,
                    "name": "Tymovirus from Grapevine 1(not confirmed)",
                    "id": "2f97f077"
                }
            ]
        }


class TestGet:

    async def test(self, test_db, do_get, test_virus, test_sequence):
        """
        Test that a valid request returns a complete virus document. 
         
        """
        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_get("/api/viruses/{}".format(test_virus["_id"]))

        assert resp.status == 200

        assert await resp.json() == {
            "abbreviation": "PVF",
            "imported": True,
            "last_indexed_version": 0,
            "modified": False,
            "most_recent_change": None,
            "name": "Prunus virus F",
            "version": 0,
            "id": "6116cba1",
            "isolates": [
                {
                    "id": "cab8b360",
                    "source_type": "isolate",
                    "source_name": "8816-v2",
                    "default": True,
                    "sequences": [
                        {
                            "id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 "
                            "segment RNA2 polyprotein 2 gene, complete cds.",
                            "host": "sweet cherry",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
                        }
                    ]
                }
             ]
        }

    async def test_no_sequences(self, test_db, do_get, test_virus):
        """
        Test that a valid request returns an empty sequence list for a virus with no associated sequences.
         
        """
        test_db.viruses.insert_one(test_virus)

        resp = await do_get("/api/viruses/" + test_virus["_id"])

        assert resp.status == 200

        assert await resp.json() == {
            "abbreviation": "PVF",
            "imported": True,
            "last_indexed_version": 0,
            "modified": False,
            "most_recent_change": None,
            "name": "Prunus virus F",
            "version": 0,
            "id": "6116cba1",
            "isolates": [
                {
                    "id": "cab8b360",
                    "source_type": "isolate",
                    "source_name": "8816-v2",
                    "default": True,
                    "sequences": []
                }
             ]
        }

    async def test_not_found(self, do_get):
        """
        Test that a request for a non-existent virus results in a ``404`` response.
         
        """
        resp = await do_get("/api/viruses/foobar")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestCreate:

    async def test(self, monkeypatch, test_db, do_post, test_add_history, test_dispatch):
        """
        Test that a valid request results in the creation of a virus document and a ``201`` response.
         
        """
        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.utils.get_new_id", get_fake_id)

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "abbreviation": "TMV",
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "most_recent_change": None,
            "name": "Tobacco mosaic virus",
            "version": 0,
            "id": "test"
        }

        assert test_db.viruses.find_one() == {
            "_id": "test",
            "lower_name": "tobacco mosaic virus",
            "name": "Tobacco mosaic virus",
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "abbreviation": "TMV",
            "version": 0
        }

        assert test_add_history.call_args[0][1:] == (
            "create",
            None,
            {
                "isolates": [],
                "name": "Tobacco mosaic virus",
                "lower_name": "tobacco mosaic virus",
                "_id": "test",
                "version": 0,
                "modified": True,
                "abbreviation": "TMV",
                "last_indexed_version": None
            },
            (
                "Created virus ",
                "Tobacco mosaic virus",
                "test"
            ),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "abbreviation": "TMV",
                "modified": True,
                "version": 0,
                "name": "Tobacco mosaic virus",
                "id": "test",
            }
        )

    async def test_invalid_input(self, do_post):
        """
        Test that invalid input results in a ``422`` response with error data.
         
        """
        data = {
            "virus_name": "Tobacco mosaic virus",
            "abbreviation": 123
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "virus_name": ["unknown field"],
                "abbreviation": ["must be of string type"],
                "name": ["required field"]
            }
        }

    @pytest.mark.parametrize("existing,message", [
        ({"name": "Tobacco mosaic virus"}, "Name already exists"),
        ({"abbreviation": "TMV"}, "Abbreviation already exists"),
        ({"name": "Tobacco mosaic virus", "abbreviation": "TMV"}, "Name and abbreviation already exist")
    ])
    async def test_field_exists(self, existing, message, test_db, do_post):
        """
        Test that the request fails with ``409 Conflict`` if the requested virus name already exists.
         
        """
        test_db.viruses.insert_one(existing)

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": message
        }


class TestEdit:

    @pytest.mark.parametrize("data, description", [
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            ("Changed name and abbreviation to", "Tobacco mosaic virus", "TMV")
        ),
        (
            {"name": "Tobacco mosaic virus"},
            ("Changed name to", "Tobacco mosaic virus")
        ),
        (
            {"abbreviation": "TMV"},
            ("Changed abbreviation to", "TMV")
        )
    ])
    async def test(self, data, description, test_db, do_patch, test_virus, test_add_history, test_dispatch):
        """
        Test that changing the name and abbreviation results in changes to the virus document and a new change
        document in history. The that change both fields or one or the other results in the correct changes and
        history record.

        """
        test_db.viruses.insert_one(test_virus)

        resp = await do_patch("/api/viruses/6116cba1", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        expected = {
            "id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "id": "cab8b360",
                    "sequences": [],
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ],
            "last_indexed_version": 0,
            "modified": True,
            "most_recent_change": None,
            "name": "Prunus virus F",
            "version": 1
        }

        old = deepcopy(expected)

        expected.update(data)

        assert await resp.json() == expected

        expected.update({
            "lower_name": expected["name"].lower(),
            "_id": expected.pop("id")
        })

        expected.pop("most_recent_change")

        for isolate in expected["isolates"]:
            isolate.pop("sequences")

        assert test_db.viruses.find_one() == expected

        expected_dispatch = {
            "id": "6116cba1",
            "name": "Prunus virus F",
            "abbreviation": "PVF",
            "modified": True,
            "version": 1
        }

        expected_dispatch.update(data)

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            expected_dispatch
        )

        old.update({
            "_id": old.pop("id"),
            "modified": False,
            "lower_name": old["name"].lower(),
            "version": 0
        })

        old.pop("most_recent_change")

        for isolate in expected["isolates"]:
            isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit",
            old,
            expected,
            description,
            "test"
        )

    async def test_invalid_input(self, do_patch):
        """
        Test that invalid input results in a ``422`` response with error data.

        """
        data = {
            "virus_name": "Tobacco mosaic virus",
            "abbreviation": 123
        }

        resp = await do_patch("/api/viruses/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "virus_name": ["unknown field"],
                "abbreviation": ["must be of string type"]
            }
        }

    async def test_name_exists(self, test_db, do_patch):
        """
        Test that the request fails with ``409 Conflict`` if the requested virus name already exists.

        """
        test_db.viruses.insert_one({
            "_id": "test",
            "name": "Tobacco mosaic virus",
            "isolates": []
        })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_patch("/api/viruses/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name already exists"
        }

    async def test_abbreviation_exists(self, test_db, do_patch):
        """
        Test that the request fails with ``409 Conflict`` if the requested abbreviation already exists.

        """
        test_db.viruses.insert_one({
            "_id": "test",
            "abbreviation": "TMV",
            "isolates": []
        })

        data = {
            "abbreviation": "TMV"
        }

        resp = await do_patch("/api/viruses/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Abbreviation already exists"
        }

    async def test_both_exist(self, test_db, do_patch):
        """
        Test that the request fails with ``409 Conflict`` if the requested name and abbreviation already exist.

        """
        test_db.viruses.insert_one({
            "_id": "test",
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV",
            "isolates": []
        })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_patch("/api/viruses/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name and abbreviation already exist"
        }


class TestVerify:

    async def test(self, test_db, do_put, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a complete virus document is returned in a ``200`` response when verification is successful. Check
        that history is updated and dispatches are made. 

        """
        test_virus["modified"] = True

        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_put("/api/viruses/6116cba1/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        expected = {
            "id": "6116cba1",
            "name": "Prunus virus F",
            "abbreviation": "PVF",
            "imported": True,
            "modified": False,
            "last_indexed_version": 0,
            "version": 1,
            "most_recent_change": None,
            "isolates": [
                {
                    "default": True,
                    "id": "cab8b360",
                    "sequences": [
                        {
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "host": "sweet cherry",
                            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete "
                                          "cds.",
                            "id": "KX269872",
                        }
                    ],
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ]
        }

        assert await resp.json() == expected

        assert test_db.viruses.find_one() == {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "id": "cab8b360",
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": False,
            "name": "Prunus virus F",
            "version": 1
        }

        old = deepcopy(test_virus)

        old["isolates"][0]["sequences"] = [test_sequence]

        new = deepcopy(expected)

        new.update({
            "_id": new.pop("id"),
            "lower_name": new["name"].lower()
        })

        del new["most_recent_change"]

        for isolate in new["isolates"]:
            for sequence in isolate["sequences"]:
                sequence.update({
                    "_id": sequence.pop("id"),
                    "virus_id": "6116cba1",
                    "isolate_id": "cab8b360"
                })


        assert test_add_history.call_args[0][1:] == (
            "verify",
            old,
            new,
            ("Verified",),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": False,
                "version": 1
            }
        )

    async def test_empty_virus(self, test_db, do_put, test_virus, test_add_history, test_dispatch):
        """
        Test that a virus with no isolates can be detected and be reported by the handler in a ``400`` response.

        """
        test_virus["isolates"] = []

        test_db.viruses.insert(test_virus)

        resp = await do_put("/api/viruses/6116cba1/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Verification errors",
            "errors": {
                "empty_isolate": False,
                "empty_sequence": False,
                "empty_virus": True,
                "isolate_inconsistency": False
            }
        }

        assert not test_add_history.called
        assert not test_dispatch.stub.called

    async def test_empty_isolate(self, test_db, do_put, test_virus, test_add_history, test_dispatch):
        """
        Test that an isolate with no sequences can be detected and be reported by the handler in a ``400`` response.

        """
        test_db.viruses.insert(test_virus)

        resp = await do_put("/api/viruses/6116cba1/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Verification errors",
            "errors": {
                "empty_isolate": ["cab8b360"],
                "empty_sequence": False,
                "empty_virus": False,
                "isolate_inconsistency": False
            }
        }

        assert not test_add_history.called
        assert not test_dispatch.stub.called

    async def test_empty_sequence(self, test_db, do_put, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that an empty sequence field can be detected and be reported by the handler in a ``400`` response.

        """
        test_db.viruses.insert(test_virus)

        test_sequence["sequence"] = ""

        test_db.sequences.insert(test_sequence)

        resp = await do_put("/api/viruses/6116cba1/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Verification errors",
            "errors": {
                "empty_isolate": False,
                "empty_sequence": ["KX269872"],
                "empty_virus": False,
                "isolate_inconsistency": False
            }
        }

        assert not test_add_history.called
        assert not test_dispatch.stub.called

    async def test_isolate_inconsistency(self, test_db, do_put, test_virus, test_sequence, test_add_history,
                                         test_dispatch):
        """
        Test that an isolate consistency can be detected and be reported by the handler in a ``400`` response.
         
        """

        test_virus["isolates"].append({
            "isolate_id": "foobar",
            "source_type": "isolate",
            "source_name": "b",
            "default": False
        })

        # Make database changes so that one isolate has one more sequence than the other isolate.
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)
        test_db.sequences.insert(dict(test_sequence, _id="a", isolate_id="foobar"))
        test_db.sequences.insert(dict(test_sequence, _id="b", isolate_id="foobar"))

        resp = await do_put("/api/viruses/6116cba1/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Verification errors",
            "errors": {
                "empty_isolate": False,
                "empty_sequence": False,
                "empty_virus": False,
                "isolate_inconsistency": True
            }
        }

        assert not test_add_history.called
        assert not test_dispatch.stub.called

    async def test_not_found(self, do_put):
        """
        Test that an isolate consistency can be detected and be reported by the handler in a ``400`` response.

        """
        resp = await do_put("/api/viruses/foobar/verify", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestRemove:

    async def test(self, test_db, do_delete, test_virus, test_add_history, test_dispatch):
        """
        Test that an existing virus can be removed.        
         
        """
        test_db.viruses.insert_one(test_virus)

        old = test_db.viruses.find_one("6116cba1")

        assert old

        resp = await do_delete("/api/viruses/6116cba1", authorize=True, permissions=["modify_virus"])

        assert resp.status == 204

        assert test_db.viruses.find({"_id": "6116cba1"}).count() == 0

        old["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "remove",
            old,
            None,
            ("Removed virus", old["name"], old["_id"]),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "remove",
            {"id": "6116cba1"}
        )

    async def test_does_not_exist(self, do_delete):
        """
        Test that attempting to remove a non-existent virus results in a ``404`` response. 
        """
        resp = await do_delete("/api/viruses/6116cba1", authorize=True, permissions=["modify_virus"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestListIsolates:

    async def test(self, test_db, do_get, test_virus):
        """
        Test the isolates are properly listed and formatted for an existing virus.
         
        """
        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        test_db.viruses.insert_one(test_virus)

        resp = await do_get("/api/viruses/6116cba1/isolates")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "id": "cab8b360"
            },
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "id": "bcb9b352"
            }
        ]

    async def test_not_found(self, do_get):
        """
        Test that a request for a non-existent virus returns a ``404`` response.
         
        """
        resp = await do_get("/api/viruses/6116cba1/isolates")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestGetIsolate:

    async def test(self, test_db, do_get, test_virus, test_sequence):
        """
        Test that an existing isolate is successfully returned.
         
        """
        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_get("/api/viruses/6116cba1/isolates/cab8b360")

        assert resp.status == 200

        test_sequence["id"] = test_sequence.pop("_id")
        del test_sequence["virus_id"]
        del test_sequence["isolate_id"]

        import pprint

        pprint.pprint(await resp.json())

        assert await resp.json() == {
            "default": True,
            "source_type": "isolate",
            "source_name": "8816-v2",
            "id": "cab8b360",
            "sequences": [test_sequence]
        }

    async def test_virus_not_found(self, do_get):
        """
        Test that a ``404`` response results for a non-existent virus.
         
        """
        resp = await do_get("/api/viruses/foobar/isolates/cab8b360")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }

    async def test_isolate_not_found(self, do_get):
        resp = await do_get("/api/viruses/6116cba1/isolates/foobar")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestAddIsolate:

    async def test_is_default(self, monkeypatch, test_db, do_post, test_virus, test_add_history, test_dispatch):
        """
        Test that a new default isolate can be added, setting ``default`` to ``False`` on all other isolates in the
        process.
         
        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": True
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "id": "test",
            "source_type": "isolate",
            "source_name": "b",
            "default": True,
            "sequences": []
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": True
            }
        ]

        for isolate in new["isolates"]:
            isolate["sequences"] = []

        test_virus["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "add_isolate",
            test_virus,
            new,
            ("Added isolate", "Isolate b", "test", "as default"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_not_default(self, monkeypatch, test_db, do_post, test_virus, test_add_history, test_dispatch):
        """
        Test that a non-default isolate can be properly added
        
        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": "test",
            "default": False,
            "sequences": []
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "source_type": "isolate",
                "source_name": "8816-v2",
                "default": True
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False
            }
        ]

        for isolate in new["isolates"]:
            isolate["sequences"] = []

        test_virus["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "add_isolate",
            test_virus,
            new,
            ("Added isolate", "Isolate b", "test"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_first(self, monkeypatch, test_db, do_post, test_virus, test_add_history, test_dispatch):
        """
        Test that the first isolate for a virus is set as the ``default`` virus even if ``default`` is set to ``False``
        in the POST input.

        """
        test_virus["isolates"] = []

        test_db.viruses.insert_one(test_virus)

        async def get_fake_id(*args):
            return "test"

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        }

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": "test",
            "default": True,
            "sequences": []
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [{
                "id": "test",
                "default": True,
                "source_type": "isolate",
                "source_name": "b"
        }]

        new["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "add_isolate",
            test_virus,
            new,
            ("Added isolate", "Isolate b", "test", "as default"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_force_case(self, monkeypatch, test_db, do_post, test_virus, test_add_history, test_dispatch):
        """
        Test that the ``source_type`` value is forced to lower case.
         
        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "source_name": "Beta",
            "source_type": "Isolate",
            "default": False
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "Beta",
            "source_type": "isolate",
            "id": "test",
            "default": False,
            "sequences": []
        }

        document = test_db.viruses.find_one("6116cba1")

        assert document["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": "test",
                "source_name": "Beta",
                "source_type": "isolate",
                "default": False
            }
        ]

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_empty(self, monkeypatch, test_db, do_post, test_virus, test_dispatch):
        """
        Test that an isolate can be added without any POST input. The resulting document should contain the defined
        default values.
         
        """
        test_db.viruses.insert_one(test_virus)

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "id": "test",
            "source_name": "",
            "source_type": "",
            "default": False,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": "test",
                "source_name": "",
                "source_type": "",
                "default": False
            }
        ]

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )


class TestEditIsolate:

    async def test_both(self, test_db, do_patch, test_virus, test_add_history, test_dispatch):
        """
        Test that an error is returned when an attempt is made to change the default field and source type and source
        name in the same request.

        """
        data = {
            "source_type": "variant",
            "default": True
        }

        resp = await do_patch("/api/viruses/6116cba1/isolates/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Can only edit one of 'source_type' and 'source_name' or 'default' at a time"
        }

    async def test_name(self, test_db, do_patch, test_virus, test_add_history, test_dispatch):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        test_virus["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        test_db.viruses.insert_one(test_virus)

        data = {
            "source_type": "variant"
        }

        resp = await do_patch("/api/viruses/6116cba1/isolates/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        assert await resp.json() == {
            "source_type": "variant",
            "id": "test",
            "source_name": "b",
            "default": False
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "variant",
                "default": False
            }
        ]

        for joined in (test_virus, new):
            for isolate in joined["isolates"]:
                isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit_isolate",
            test_virus,
            new,
            ("Renamed", "Isolate b", "to", "Variant b", "test"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_to_default(self, test_db, do_patch, test_virus, test_add_history, test_dispatch):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        test_virus["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        test_db.viruses.insert_one(test_virus)

        data = {
            "default": True
        }

        resp = await do_patch("/api/viruses/6116cba1/isolates/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        assert await resp.json() == {
            "source_type": "isolate",
            "id": "test",
            "source_name": "b",
            "default": True
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": True
            }
        ]

        for joined in (test_virus, new):
            for isolate in joined["isolates"]:
                isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit_isolate",
            test_virus,
            new,
            ("Set", "Isolate b", "test", "as default"),
            "test"
        )

    async def test_unset_default(self, test_db, do_patch, test_virus, test_dispatch):
        """
        Test that attempting to set ``default`` to ``False`` for a default isolate results in a ``400`` response. The
        appropriate way to change the default isolate is to set ``default`` to ``True`` on another isolate.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "default": False
        }

        async def get_fake_id(*args):
            return "test"

        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", data, authorize=True,
                              permissions=["modify_virus"])

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "default": ["unallowed value False"]
            }
        }

        assert test_dispatch.stub.call_args is None

    async def test_force_case(self, monkeypatch, test_db, do_patch, test_virus, test_dispatch):
        """
        Test that the ``source_type`` value is forced to lower case.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "source_type": "Variant",
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", data, authorize=True,
                              permissions=["modify_virus"])

        assert resp.status == 200

        expected = {
            "id": "cab8b360",
            "default": True,
            "source_type": "variant",
            "source_name": "8816-v2"
        }

        assert await resp.json() == expected

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [expected]

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_empty(self, do_patch, test_dispatch):
        """
        Test that an empty data input results in a ``400`` response.

        """
        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", {}, authorize=True,
                              permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Empty input"
        }

        assert test_dispatch.stub.call_args is None


class TestRemoveIsolate:

    async def test(self, test_db, do_delete, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a valid request results in a ``204`` response and the isolate and sequence data is removed from the
        database.
         
        """
        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        assert test_db.viruses.find({"isolates.id": "cab8b360"}).count() == 1

        resp = await do_delete("/api/viruses/6116cba1/isolates/cab8b360", authorize=True, permissions=["modify_virus"])

        assert resp.status == 204

        assert test_db.viruses.find({"isolates.id": "cab8b360"}).count() == 0

        assert test_db.sequences.count() == 0

        old = {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "id": "cab8b360",
                    "source_type": "isolate",
                    "source_name": "8816-v2",
                    "default": True,
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 "
                            "segment RNA2 polyprotein 2 gene, "
                            "complete cds.",
                            "host": "sweet cherry",
                            "virus_id": "6116cba1",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
                        }
                    ]
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": False,
            "name": "Prunus virus F",
            "version": 0
        }

        new = deepcopy(old)

        new.update({
            "version": 1,
            "modified": True,
            "isolates": []
        })

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            new,
            ("Removed isolate", "Isolate 8816-v2", "cab8b360"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    async def test_change_default(self, test_db, do_delete, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a valid request results in a ``204`` response and ``default`` status is reassigned correctly.

        """
        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_delete("/api/viruses/6116cba1/isolates/cab8b360", authorize=True, permissions=["modify_virus"])

        assert resp.status == 204

        assert test_db.viruses.find({"isolates.id": "cab8b360"}).count() == 0

        assert test_db.viruses.find_one({"isolates.id": "bcb9b352"}, ["isolates"])["isolates"][0]["default"]

        assert test_db.sequences.count() == 0

        old = {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "id": "cab8b360",
                    "source_type": "isolate",
                    "source_name": "8816-v2",
                    "default": True,
                    "sequences": [
                        {
                            "_id": "KX269872",
                            "definition": "Prunus virus F isolate 8816-s2 "
                                          "segment RNA2 polyprotein 2 gene, "
                                          "complete cds.",
                            "host": "sweet cherry",
                            "virus_id": "6116cba1",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
                        }
                    ]
                },
                {
                    "default": False,
                    "source_type": "isolate",
                    "source_name": "7865",
                    "id": "bcb9b352",
                    "sequences": []
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": False,
            "name": "Prunus virus F",
            "version": 0
        }

        new = {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "source_type": "isolate",
                    "source_name": "7865",
                    "id": "bcb9b352",
                    "sequences": []
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": True,
            "name": "Prunus virus F",
            "version": 1
        }

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            new,
            ("Removed isolate", "Isolate 8816-v2", "cab8b360", "and set", "Isolate 7865", "bcb9b352", "as default"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "abbreviation": "PVF",
                "modified": True,
                "version": 1
            }
        )

    @pytest.mark.parametrize("url", ["/api/viruses/foobar/isolates/cab8b360", "/api/viruses/test/isolates/foobar"])
    async def test_not_found(self, url, do_delete, test_db, test_virus):
        """
        Test that removal fails with ``404`` if the virus does not exist.
         
        """
        test_db.viruses.insert(test_virus)

        resp = await do_delete(url, authorize=True, permissions=["modify_virus"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestListSequences:

    async def test(self, do_get, test_db, test_virus, test_sequence):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        resp = await do_get("/api/viruses/6116cba1/isolates/cab8b360/sequences")

        assert resp.status == 200

        test_sequence["accession"] = test_sequence.pop("_id")

        assert await resp.json() == [{
            "id": "KX269872",
            "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
            "host": "sweet cherry",
            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC"
        }]

    @pytest.mark.parametrize("url", [
        "/api/viruses/6116cba1/isolates/foobar/sequences",
        "/api/viruses/foobar/isolates/cab8b360/sequences"
    ])
    async def test_not_found(self, url, do_get):
        resp = await do_get(url)

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestGetSequence:

    async def test(self, do_get, test_db, test_virus, test_sequence):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        resp = await do_get("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872")

        assert resp.status == 200

        test_sequence["id"] = test_sequence.pop("_id")

        assert await resp.json() == test_sequence

    @pytest.mark.parametrize("url", [
        "/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872",
        "/api/viruses/6116cba1/isolates/cab8b360/sequences/foobar",
        "/api/viruses/6116cba1/isolates/foobar/sequences/KX269872",
        "/api/viruses/foobar/isolates/cab8b360/sequences/KX269872",
    ])
    async def test_not_found(self, url, do_get):
        resp = await do_get(url)

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestCreateSequence:

    async def test(self, do_post, test_db, test_virus, test_add_history, test_dispatch):
        test_db.viruses.insert(test_virus)

        data = {
            "accession": "FOOBAR",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        resp = await do_post(
            "/api/viruses/6116cba1/isolates/cab8b360/sequences",
            data,
            authorize=True,
            permissions=["modify_virus"]
        )

        data.update({
            "isolate_id": "cab8b360",
            "virus_id": "6116cba1"
        })

        assert resp.status == 200

        assert await resp.json() == {
            "id": "FOOBAR",
            "definition": "A made up sequence",
            "virus_id": "6116cba1",
            "isolate_id": "cab8b360",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG"
        }

        description = (
            "Created new sequence",
            "FOOBAR",
            "in isolate",
            "Isolate 8816-v2",
            "cab8b360"
        )

        old = {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "id": "cab8b360",
                    "sequences": [],
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": False,
            "name": "Prunus virus F",
            "version": 0
        }

        new = deepcopy(old)

        new["isolates"][0]["sequences"] = [{
            "_id": "FOOBAR",
            "definition": "A made up sequence",
            "virus_id": "6116cba1",
            "isolate_id": "cab8b360",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG"
        }]

        new.update({
            "modified": True,
            "version": 1
        })

        assert test_add_history.call_args[0][1:] == (
            "create_sequence",
            old,
            new,
            description,
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "abbreviation": "PVF",
                "modified": True,
                "name": "Prunus virus F",
                "version": 1
            }
        )

    async def test_exists(self, do_post, test_db, test_virus, test_sequence):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        data = {
            "accession": "KX269872",
            "sequence": "ATGCGTGTACTG",
            "definition": "An already existing sequence"
        }

        resp = await do_post(
            "/api/viruses/6116cba1/isolates/cab8b360/sequences",
            data,
            authorize=True,
            permissions=["modify_virus"]
        )

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Accession already exists"
        }

    async def test_invalid_input(self, do_post):
        """
        Test that invalid input results in a ``422`` response with error information.
         
        """
        data = {
            "accession": 2016,
            "seq": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        resp = await do_post(
            "/api/viruses/6116cba1/isolates/cab8b360/sequences",
            data,
            authorize=True,
            permissions=["modify_virus"]
        )

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "accession": ["must be of string type"],
                "sequence": ["required field"],
                "seq": ["unknown field"]
            }
        }

    @pytest.mark.parametrize("virus_id, isolate_id", [
        ("6116cba1", "cab8b360"),
        ("6116cba1", "foobar"),
        ("foobar", "cab8b360")
    ])
    async def test_not_found(self, virus_id, isolate_id, do_post):
        """
        Test that non-existent virus or isolate ids in the URL result in a ``404`` response.
         
        """
        data = {
            "accession": "FOOBAR",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        url = "/api/viruses/{}/isolates/{}/sequences".format(virus_id, isolate_id)

        resp = await do_post(url, data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestEditSequence:

    async def test(self, do_patch, test_db, test_virus, test_sequence, test_add_history, test_dispatch):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        data = {
            "host": "Grapevine",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        resp = await do_patch(
            "/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872",
            data,
            authorize=True,
            permissions=["modify_virus"]
        )

        assert resp.status == 200

        assert await resp.json() == {
            "id": "KX269872",
            "definition": "A made up sequence",
            "host": "Grapevine",
            "virus_id": "6116cba1",
            "isolate_id": "cab8b360",
            "sequence": "ATGCGTGTACTG"
        }

        old = {
            "_id": "6116cba1",
            "abbreviation": "PVF",
            "imported": True,
            "isolates": [
                {
                    "default": True,
                    "id": "cab8b360",
                    "sequences": [dict(test_sequence, virus_id="6116cba1")],
                    "source_name": "8816-v2",
                    "source_type": "isolate"
                }
            ],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "modified": False,
            "name": "Prunus virus F",
            "version": 0
        }

        new = deepcopy(old)

        new["isolates"][0]["sequences"] = [{
            "_id": "KX269872",
            "definition": "A made up sequence",
            "virus_id": "6116cba1",
            "isolate_id": "cab8b360",
            "host": "Grapevine",
            "sequence": "ATGCGTGTACTG"
        }]

        new.update({
            "modified": True,
            "version": 1
        })

        assert test_add_history.call_args[0][1:] == (
            "edit_sequence",
            old,
            new,
            ("Edited sequence", "KX269872", "in isolate", "Isolate 8816-v2", "cab8b360"),
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "id": "6116cba1",
                "abbreviation": "PVF",
                "modified": True,
                "name": "Prunus virus F",
                "version": 1
            }
        )

    async def test_invalid_input(self, do_patch):
        resp = await do_patch(
            "/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872",
            {
                "plant": "Grapevine",
                "sequence": "ATGCGTGTACTG",
                "definition": 123
            },
            authorize=True,
            permissions=["modify_virus"]
        )

        assert resp.status == 422

        assert await resp.json() == {
            "id": "invalid_input",
            "message": "Invalid input",
            "errors": {
                "definition": ["must be of string type"],
                "plant": ["unknown field"]
            }
        }

    @pytest.mark.parametrize("foobar", ["virus_id", "isolate_id", "sequence_id"])
    async def test_not_found(self, foobar, do_patch, test_db, test_virus, test_sequence):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        url = "/api/viruses/{}/isolates/{}/sequences/{}".format(
            "foobar" if foobar == "virus_id" else "6116cba1",
            "foobar" if foobar == "isolate_id" else "cab8b360",
            "foobar" if foobar == "sequence_id" else "KX269872"
        )

        resp = await do_patch(
            url,
            {
                "host": "Grapevine",
                "sequence": "ATGCGTGTACTG",
                "definition": "A made up sequence"
            },
            authorize=True,
            permissions=["modify_virus"]
        )

        assert resp.status == 404

        if foobar == "sequence_id":
            assert await resp.json() == {
                "message": "Sequence not found"
            }

        else:
            assert await resp.json() == {
                "message": "Virus or isolate not found"
            }
