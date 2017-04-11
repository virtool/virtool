import pytest
from copy import deepcopy

from virtool.viruses import processor, dispatch_processor


class TestFind:

    async def test(self, test_db, do_get):
        documents = [
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
        ]

        test_db.viruses.insert_many(documents)

        resp = await do_get("/api/viruses")

        assert resp.status == 200

        assert await resp.json() == [dispatch_processor(d) for d in documents]


class TestGet:

    async def test(self, test_db, do_get, test_virus, test_sequence, test_merged_virus):
        """
        Test that a valid request returns a complete virus document. 
         
        """
        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_get("/api/viruses/" + test_virus["_id"])

        assert resp.status == 200

        assert await resp.json() == test_merged_virus

    async def test_no_sequences(self, test_db, do_get, test_virus, test_merged_virus):
        """
        Test that a valid request returns an empty sequence list for a virus with no associated sequences.
         
        """
        test_db.viruses.insert_one(test_virus)

        resp = await do_get("/api/viruses/" + test_virus["_id"])

        assert resp.status == 200

        test_merged_virus["isolates"][0]["sequences"] = []

        assert await resp.json() == test_merged_virus

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

    async def test(self, monkeypatch, test_db, do_post, test_add_history):
        """
        Test that a valid request results in the creation of a virus document and a ``201`` response.
         
        """
        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.data_utils.get_new_id", get_fake_id)

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        expected = {
            "virus_id": "test",
            "lower_name": "tobacco mosaic virus",
            "name": "Tobacco mosaic virus",
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "abbreviation": "TMV",
            "version": 0
        }

        assert await resp.json() == expected

        expected["_id"] = expected.pop("virus_id")

        assert test_db.viruses.find_one() == expected

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
            "message": "Invalid input",
            "errors": {
                "virus_name": ["unknown field"],
                "abbreviation": ["must be of string type"],
                "name": ["required field"]
            }
        }

    async def test_name_exists(self, test_db, do_post):
        """
        Test that the request fails with ``409 Conflict`` if the requested virus name already exists.
         
        """
        test_db.viruses.insert_one({
            "name": "Tobacco mosaic virus"
        })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name already exists"
        }

    async def test_abbreviation_exists(self, test_db, do_post):
        """
        Test that the request fails with ``409 Conflict`` if the requested abbreviation already exists.
         
        """
        test_db.viruses.insert_one({
            "abbreviation": "TMV"
        })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Abbreviation already exists"
        }

    async def test_both_exist(self, test_db, do_post):
        """
        Test that the request fails with ``409 Conflict`` if the requested name and abbreviation already exist.

        """
        test_db.viruses.insert_one({
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name and abbreviation already exist"
        }


class TestEdit:

    async def test_both(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that changing the name and abbreviation results in changes to the virus document and a new change
        document in history.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_patch("/api/viruses/6116cba1", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        expected = deepcopy(test_virus)

        expected.update({
            "name": "Tobacco mosaic virus",
            "lower_name": "tobacco mosaic virus",
            "abbreviation": "TMV",
            "modified": True,
            "version": 1
        })

        assert dict(test_db.viruses.find_one()) == expected

        for document in (test_virus, expected):
            document["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit",
            test_virus,
            expected,
            ("Changed name and abbreviation to", "Tobacco mosaic virus", "TMV"),
            "test"
        )

        assert await resp.json() == processor(expected)

    async def test_name(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that a changing the name results in changes to the virus document and a new change document in history.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "name": "Tobacco mosaic virus"
        }

        resp = await do_patch("/api/viruses/6116cba1", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        expected = deepcopy(test_virus)

        expected.update({
            "name": "Tobacco mosaic virus",
            "lower_name": "tobacco mosaic virus",
            "modified": True,
            "version": 1
        })

        assert test_db.viruses.find_one() == expected

        for document in (test_virus, expected):
            document["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit",
            test_virus,
            expected,
            ("Changed name to", "Tobacco mosaic virus"),
            "test"
        )

        assert await resp.json() == processor(expected)

    async def test_abbreviation(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that changing the abbreviation results in changes to the virus document and a new change document in
        history.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "abbreviation": "TMV"
        }

        resp = await do_patch("/api/viruses/6116cba1", data, authorize=True, permissions=["modify_virus"])

        print(await resp.json())

        assert resp.status == 200

        expected = deepcopy(test_virus)

        expected.update({
            "abbreviation": "TMV",
            "modified": True,
            "version": 1
        })

        assert test_db.viruses.find_one() == expected

        for document in (test_virus, expected):
            document["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit",
            test_virus,
            expected,
            ("Changed abbreviation to", "TMV"),
            "test"
        )

        assert await resp.json() == processor(expected)

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


class TestRemove:

    async def test(self, test_db, do_delete, test_virus, test_add_history):
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
            "isolate_id": "bcb9b352"
        })

        test_db.viruses.insert_one(test_virus)

        resp = await do_get("/api/viruses/6116cba1/isolates")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "isolate_id": "cab8b360"
            },
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "isolate_id": "bcb9b352"
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

        assert await resp.json() == {
            "default": True,
            "source_type": "isolate",
            "source_name": "8816-v2",
            "isolate_id": "cab8b360",
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

    async def test_is_default(self, monkeypatch, test_db, do_post, test_virus, test_add_history):
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

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "isolate_id": "test",
            "default": True
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
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

    async def test_not_default(self, monkeypatch, test_db, do_post, test_virus, test_add_history):
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

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "isolate_id": "test",
            "default": False
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
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

    async def test_first(self, monkeypatch, test_db, do_post, test_virus, test_add_history):
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

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "isolate_id": "test",
            "default": True
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [{
                "isolate_id": "test",
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

    async def test_force_case(self, monkeypatch, test_db, do_post, test_virus):
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

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "Beta",
            "source_type": "isolate",
            "isolate_id": "test",
            "default": False
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
                "source_name": "Beta",
                "source_type": "isolate",
                "default": False
            }
        ]

    async def test_empty(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that an isolate can be added without any POST input. The resulting document should contain the defined
        default values.
         
        """
        test_db.viruses.insert_one(test_virus)

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "",
            "source_type": "",
            "isolate_id": "test",
            "default": False
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
                "source_name": "",
                "source_type": "",
                "default": False
            }
        ]


class TestEditIsolate:

    async def test_both(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that the isolate can be edited such that it is the default isolate and all other isolates are set with
        ``default`` to ``False``.

        """
        test_virus["isolates"].append({
            "isolate_id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        test_db.viruses.insert_one(test_virus)

        data = {
            "source_type": "variant",
            "default": True
        }

        resp = await do_patch("/api/viruses/6116cba1/isolates/test", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        assert await resp.json() == {
            "source_type": "variant",
            "isolate_id": "test",
            "source_name": "b",
            "default": True
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
                "source_name": "b",
                "source_type": "variant",
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
            ("Renamed isolate to", "Variant b", "test", "and set as default"),
            "test"
        )

    async def test_name(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        test_virus["isolates"].append({
            "isolate_id": "test",
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
            "isolate_id": "test",
            "source_name": "b",
            "default": False
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
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
            ("Renamed isolate to", "Variant b", "test"),
            "test"
        )

    async def test_to_default(self, test_db, do_patch, test_virus, test_add_history):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        test_virus["isolates"].append({
            "isolate_id": "test",
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
            "isolate_id": "test",
            "source_name": "b",
            "default": True
        }

        new = test_db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "isolate_id": "test",
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

    async def test_unset_default(self, test_db, do_patch, test_virus):
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
            "message": "Invalid input",
            "errors": {
                "default": ["unallowed value False"]
            }
        }

    async def test_force_case(self, monkeypatch, test_db, do_patch, test_virus):
        """
        Test that the ``source_type`` value is forced to lower case.

        """
        test_db.viruses.insert_one(test_virus)

        data = {
            "source_type": "Variant",
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", data, authorize=True,
                              permissions=["modify_virus"])

        assert resp.status == 200

        expected = {
            "isolate_id": "cab8b360",
            "default": True,
            "source_type": "variant",
            "source_name": "8816-v2"
        }

        assert await resp.json() == expected

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [expected]

    async def test_empty(self, do_patch):
        """
        Test that an empty data input results in a ``400`` response.

        """
        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", {}, authorize=True,
                              permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Empty input"
        }


class TestRemoveIsolate:

    async def test(self, test_db, do_delete, test_virus, test_sequence, test_add_history):
        """
        Test that a valid request results in a ``204`` response and the isolate and sequence data is removed from the
        database.
         
        """
        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        assert test_db.viruses.find({"isolates.isolate_id": "cab8b360"}).count() == 1

        resp = await do_delete("/api/viruses/6116cba1/isolates/cab8b360", authorize=True, permissions=["modify_virus"])

        assert resp.status == 204

        assert test_db.viruses.find({"isolates.isolate_id": "cab8b360"}).count() == 0

        assert test_db.sequences.count() == 0

        old = deepcopy(test_virus)
        old["isolates"][0]["sequences"] = [test_sequence]

        test_virus.update({
            "isolates": [],
            "modified": True
        })

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            test_virus,
            ("Removed isolate", "Isolate 8816-v2", "cab8b360"),
            "test"
        )

    async def test_reassign_default(self, test_db, do_delete, test_virus, test_sequence, test_add_history):
        """
        Test that a valid request results in a ``204`` response and ``default`` status is reassigned correctly.

        """
        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "isolate_id": "bcb9b352"
        })

        test_db.viruses.insert_one(test_virus)
        test_db.sequences.insert_one(test_sequence)

        resp = await do_delete("/api/viruses/6116cba1/isolates/cab8b360", authorize=True, permissions=["modify_virus"])

        assert resp.status == 204

        assert test_db.viruses.find({"isolates.isolate_id": "cab8b360"}).count() == 0

        assert test_db.viruses.find_one({"isolates.isolate_id": "bcb9b352"}, ["isolates"])["isolates"][0]["default"]

        assert test_db.sequences.count() == 0

        old = deepcopy(test_virus)
        old["isolates"][0]["sequences"] = [test_sequence]
        old["isolates"][1]["sequences"] = []

        test_virus.update({
            "isolates": [test_virus["isolates"][1]],
            "modified": True
        })

        test_virus["isolates"][0].update({
            "default": True,
            "sequences": []
        })

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            test_virus,
            ("Removed isolate", "Isolate 8816-v2", "cab8b360", "and set", "Isolate 7865", "bcb9b352", "as default"),
            "test"
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
