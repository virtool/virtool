import pytest
from copy import deepcopy

import virtool.virus


class TestFind:

    @pytest.mark.parametrize("term,modified,per_page,page,d_range,add_modified,meta", [
        (None, None, None, None, range(0, 3), False, {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 3,
            "total_count": 3,
            "modified_count": 0,
        }),
        # Test ``per_page`` query param.
        (None, None, 2, 1, range(0, 2), False, {
            "page": 1,
            "per_page": 2,
            "page_count": 2,
            "found_count": 3,
            "total_count": 3,
            "modified_count": 0,
        }),
        # Test ``per_page`` and ``page`` query param.
        (None, None, 2, 2, range(2, 3), False, {
            "page": 2,
            "per_page": 2,
            "page_count": 2,
            "found_count": 3,
            "total_count": 3,
            "modified_count": 0,
        }),
        # Test ``term`` query param and ``found_count`` response field.
        ("pvf", None, None, None, range(1, 2), False, {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 1,
            "total_count": 3,
            "modified_count": 0,
        }),
        # Test ``modified`` query param when set to ``True``. Should only return modified viruses.
        (None, True, None, None, range(2, 3), True, {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 1,
            "total_count": 3,
            "modified_count": 1,
        }),
        # Test ``modified`` query param when set to ``False``. Should only return unmodified viruses.
        (None, False, None, None, range(0, 2), True, {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 2,
            "total_count": 3,
            "modified_count": 1,
        }),
        # Test ``modified_count`` calculation.
        (None, None, 15, 1, range(0, 3), True, {
            "page": 1,
            "per_page": 15,
            "page_count": 1,
            "found_count": 3,
            "total_count": 3,
            "modified_count": 1,
        })
    ])
    async def test(self, term, modified, per_page, page, d_range, meta, add_modified, spawn_client):
        client = await spawn_client()
        
        await client.db.viruses.insert_many([
            {
                "abbreviation": "EV_TF3-mycovirus",
                "modified": False,
                "name": "Endornavirus of Tree Fruit #3",
                "_id": "5350af44"
            },
            {
                "abbreviation": "PVF",
                "modified": False,
                "name": "Prunus virus F",
                "_id": "6116cba1"
            },
            {
                "abbreviation": "TyV_GV1 (not confirmed)",
                "modified": False,
                "name": "Tymovirus from Grapevine 1(not confirmed)",
                "_id": "2f97f077"
            }
        ])

        if add_modified:
            await client.db.viruses.update_one({"_id": "2f97f077"}, {
                "$set": {
                    "modified": True
                }
            })

        path = "/api/viruses"
        query = list()

        if term is not None:
            query.append("term={}".format(term))

        if modified is not None:
            query.append("modified={}".format(str(modified).lower()))

        if per_page is not None:
            query.append("per_page={}".format(per_page))

        if page is not None:
            query.append("page={}".format(page))

        if len(query):
            path += "?{}".format("&".join(query))

        resp = await client.get(path)

        assert resp.status == 200

        expected_documents = [
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
                "modified": add_modified,
                "name": "Tymovirus from Grapevine 1(not confirmed)",
                "id": "2f97f077"
            }
        ]

        assert await resp.json() == dict(meta, documents=[expected_documents[i] for i in d_range])


class TestGet:

    async def test(self, spawn_client, test_virus, test_sequence):
        """
        Test that a valid request returns a complete virus document. 
         
        """
        client = await spawn_client()

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        resp = await client.get("/api/viruses/{}".format(test_virus["_id"]))

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

    async def test_no_sequences(self, spawn_client, test_virus):
        """
        Test that a valid request returns an empty sequence list for a virus with no associated sequences.
         
        """
        client = await spawn_client()

        await client.db.viruses.insert_one(test_virus)

        resp = await client.get("/api/viruses/" + test_virus["_id"])

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

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a request for a non-existent virus results in a ``404`` response.
         
        """
        client = await spawn_client()

        resp = await client.get("/api/viruses/foobar")

        assert await resp_is.not_found(resp)


class TestCreate:

    @pytest.mark.parametrize("data,description", [
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            "Created Tobacco mosaic virus (TMV)"
        ),
        (
            {"name": "Tobacco mosaic virus"},
            "Created Tobacco mosaic virus"
        )
    ])
    async def test(self, data, description, monkeypatch, spawn_client, test_add_history, test_dispatch):
        """
        Test that a valid request results in the creation of a virus document and a ``201`` response.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.utils.get_new_id", get_fake_id)

        resp = await client.post("/api/viruses", data)

        assert resp.status == 201

        expected_abbreviation = data.get("abbreviation", "") or ""

        assert await resp.json() == {
            "abbreviation": expected_abbreviation,
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "most_recent_change": None,
            "name": "Tobacco mosaic virus",
            "version": 0,
            "id": "test"
        }

        assert await client.db.viruses.find_one() == {
            "_id": "test",
            "lower_name": "tobacco mosaic virus",
            "name": "Tobacco mosaic virus",
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "abbreviation": expected_abbreviation,
            "version": 0
        }

        assert test_add_history.call_args[0][1:] == (
            "create",
            None,
            {
                "isolates": [],
                "name": "Tobacco mosaic virus",
                "abbreviation": expected_abbreviation,
                "lower_name": "tobacco mosaic virus",
                "_id": "test",
                "version": 0,
                "modified": True,
                "last_indexed_version": None
            },
            description,
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "update",
            {
                "abbreviation": expected_abbreviation,
                "modified": True,
                "version": 0,
                "name": "Tobacco mosaic virus",
                "id": "test",
            }
        )

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid input results in a ``422`` response with error data.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        data = {
            "virus_name": "Tobacco mosaic virus",
            "abbreviation": 123
        }

        resp = await client.post("/api/viruses", data)

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "virus_name": ["unknown field"],
            "abbreviation": ["must be of string type"],
            "name": ["required field"]
        })

    @pytest.mark.parametrize("existing,message", [
        ({"name": "Tobacco mosaic virus"}, "Name already exists"),
        ({"abbreviation": "TMV"}, "Abbreviation already exists"),
        ({"name": "Tobacco mosaic virus", "abbreviation": "TMV"}, "Name and abbreviation already exist")
    ])
    async def test_field_exists(self, existing, message, spawn_client):
        """
        Test that the request fails with ``409 Conflict`` if the requested virus name already exists.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(existing)

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await client.post("/api/viruses", data)

        assert resp.status == 409

        assert await resp.json() == {
            "message": message
        }


class TestEdit:

    @pytest.mark.parametrize("data, existing_abbreviation, description", [
        # Name, ONLY.
        (
            {"name": "Tobacco mosaic virus"},
            "TMV",
            "Changed name to Tobacco mosaic virus"
        ),
        # Name and abbreviation, BOTH CHANGE.
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            "PVF",
            "Changed name to Tobacco mosaic virus and abbreviation to TMV"
        ),
        # Name and abbreviation, NO NAME CHANGE because old is same as new.
        (
            {"name": "Prunus virus F", "abbreviation": "TMV"},
            "PVF",
            "Changed abbreviation to TMV"
        ),
        # Name and abbreviation, NO ABBR CHANGE because old is same as new.
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            "TMV",
            "Changed name to Tobacco mosaic virus"
        ),
        # Name and abbreviation, ABBR REMOVED because old is "TMV" and new is "".
        (
            {"name": "Tobacco mosaic virus", "abbreviation": ""},
            "TMV",
            "Changed name to Tobacco mosaic virus and removed abbreviation TMV"
        ),
        # Name and abbreviation, ABBR ADDED because old is "" and new is "TMV".
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            "",
            "Changed name to Tobacco mosaic virus and added abbreviation TMV"
        ),
        # Abbreviation, ONLY.
        (
            {"abbreviation": "TMV"},
            "PVF",
            "Changed abbreviation to TMV"
        ),
        # Abbreviation, ONLY because old name is same as new.
        (
            {"name": "Prunus virus F", "abbreviation": "TMV"},
            "PVF",
            "Changed abbreviation to TMV"
        ),
        # Abbreviation, ADDED.
        (
            {"abbreviation": "TMV"},
            "",
            "Added abbreviation TMV"
        ),
        # Abbreviation, REMOVED.
        (
            {"abbreviation": ""},
            "TMV",
            "Removed abbreviation TMV"
        )
    ])
    async def test(self, data, existing_abbreviation, description, spawn_client, test_virus, test_add_history,
                   test_dispatch):
        """
        Test that changing the name and abbreviation results in changes to the virus document and a new change
        document in history. The that change both fields or one or the other results in the correct changes and
        history record.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["abbreviation"] = existing_abbreviation

        await client.db.viruses.insert_one(test_virus)

        resp = await client.patch("/api/viruses/6116cba1", data)

        assert resp.status == 200

        expected = {
            "id": "6116cba1",
            "abbreviation": existing_abbreviation,
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

        assert await client.db.viruses.find_one() == expected

        expected_dispatch = {
            "id": "6116cba1",
            "name": "Prunus virus F",
            "abbreviation": existing_abbreviation,
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

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid input results in a ``422`` response with error data.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        data = {
            "virus_name": "Tobacco mosaic virus",
            "abbreviation": 123
        }

        resp = await client.patch("/api/viruses/test", data)

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "virus_name": ["unknown field"],
            "abbreviation": ["must be of string type"]
        })

    async def test_name_exists(self, spawn_client):
        """
        Test that the request fails with ``409 Conflict`` if the requested virus name already exists.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_many([
            {
                "_id": "test",
                "name": "Prunus virus F",
                "lower_name": "prunus virus f",
                "isolates": []
            },
            {
                "_id": "conflict",
                "name": "Tobacco mosaic virus",
                "lower_name": "tobacco mosaic virus",
                "isolates": []
            }
        ])

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/viruses/test", data)

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name already exists"
        }

    async def test_abbreviation_exists(self, spawn_client):
        """
        Test that the request fails with ``409 Conflict`` if the requested abbreviation already exists.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_many([
            {
                "_id": "test",
                "name": "Prunus virus F",
                "lower_name": "prunus virus f",
                "abbreviation": "PVF",
                "isolates": []
            },
            {
                "_id": "conflict",
                "name": "Tobacco mosaic virus",
                "lower_name": "tobacco mosaic virus",
                "abbreviation": "TMV",
                "isolates": []
            }
        ])

        data = {
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/viruses/test", data)

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Abbreviation already exists"
        }

    async def test_both_exist(self, spawn_client):
        """
        Test that the request fails with ``409 Conflict`` if the requested name and abbreviation already exist.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_many([
            {
                "_id": "test",
                "name": "Prunus virus F",
                "lower_name": "prunus virus f",
                "abbreviation": "PVF",
                "isolates": []
            },
            {
                "_id": "conflict",
                "name": "Tobacco mosaic virus",
                "lower_name": "tobacco mosaic virus",
                "abbreviation": "TMV",
                "isolates": []
            }
        ])

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/viruses/test", data)

        assert resp.status == 409

        assert await resp.json() == {
            "message": "Name and abbreviation already exist"
        }

    @pytest.mark.parametrize("old_name,old_abbr,data", [
        ("Tobacco mosaic virus", "TMV", {"name": "Tobacco mosaic virus", "abbreviation": "TMV"}),
        ("Tobacco mosaic virus", "TMV", {"name": "Tobacco mosaic virus"}),
        ("Tobacco mosaic virus", "TMV", {"abbreviation": "TMV"})
    ])
    async def test_no_change(self, old_name, old_abbr, data, spawn_client):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one({
            "_id": "test",
            "name": old_name,
            "lower_name": "tobacco mosaic virus",
            "abbreviation": old_abbr,
            "isolates": []
        })

        resp = await client.patch("/api/viruses/test", data)

        assert resp.status == 200
        
        assert await resp.json() == {
            "abbreviation": "TMV",
            "id": "test",
            "isolates": [],
            "most_recent_change": None,
            "name": "Tobacco mosaic virus"
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/viruses/test", data)

        assert await resp_is.not_found(resp)


class TestVerify:

    async def test(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a complete virus document is returned in a ``200`` response when verification is successful. Check
        that history is updated and dispatches are made. 

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["modified"] = True

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        resp = await client.put("/api/viruses/6116cba1/verify", {})

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

        assert await client.db.viruses.find_one() == {
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
            "Verified",
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

    async def test_empty_virus(self, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that a virus with no isolates can be detected and be reported by the handler in a ``400`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["isolates"] = []

        await client.db.viruses.insert(test_virus)

        resp = await client.put("/api/viruses/6116cba1/verify", {})

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

    async def test_empty_isolate(self, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that an isolate with no sequences can be detected and be reported by the handler in a ``400`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert(test_virus)

        resp = await client.put("/api/viruses/6116cba1/verify", {})

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

    async def test_empty_sequence(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that an empty sequence field can be detected and be reported by the handler in a ``400`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert(test_virus)

        test_sequence["sequence"] = ""

        await client.db.sequences.insert(test_sequence)

        resp = await client.put("/api/viruses/6116cba1/verify", {})

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

    async def test_isolate_inconsistency(self, spawn_client, test_virus, test_sequence, test_add_history,
                                         test_dispatch):
        """
        Test that an isolate consistency can be detected and be reported by the handler in a ``400`` response.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["isolates"].append({
            "id": "foobar",
            "source_type": "isolate",
            "source_name": "b",
            "default": False
        })

        # Make database changes so that one isolate has one more sequence than the other isolate.
        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)
        await client.db.sequences.insert_many([
            dict(test_sequence, _id="a", isolate_id="foobar"),
            dict(test_sequence, _id="b", isolate_id="foobar")
        ])

        resp = await client.put("/api/viruses/6116cba1/verify", {})

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

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that an isolate consistency can be detected and be reported by the handler in a ``400`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.put("/api/viruses/foobar/verify", {})

        assert resp.status == 404

        assert await resp_is.not_found(resp)


class TestRemove:

    @pytest.mark.parametrize("abbreviation,description", [
        ("", "Removed Prunus virus F"),
        ("PVF", "Removed Prunus virus F (PVF)")
    ])
    async def test(self, abbreviation, description, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that an existing virus can be removed.        
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["abbreviation"] = abbreviation

        await client.db.viruses.insert_one(test_virus)

        old = await client.db.viruses.find_one("6116cba1")

        assert old

        resp = await client.delete("/api/viruses/6116cba1")

        assert resp.status == 204

        assert await client.db.viruses.find({"_id": "6116cba1"}).count() == 0

        old["isolates"][0]["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "remove",
            old,
            None,
            description,
            "test"
        )

        assert test_dispatch.stub.call_args[0] == (
            "viruses",
            "remove",
            ["6116cba1"]
        )

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that attempting to remove a non-existent virus results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.delete("/api/viruses/6116cba1")

        assert await resp_is.not_found(resp)


class TestListIsolates:

    async def test(self, spawn_client, test_virus):
        """
        Test the isolates are properly listed and formatted for an existing virus.
         
        """
        client = await spawn_client()

        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        await client.db.viruses.insert_one(test_virus)

        resp = await client.get("/api/viruses/6116cba1/isolates")

        assert resp.status == 200

        assert await resp.json() == [
            {
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "id": "cab8b360",
                "sequences": []
            },
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "id": "bcb9b352",
                "sequences": []
            }
        ]

    async def test_not_found(self, spawn_client, resp_is):
        """
        Test that a request for a non-existent virus returns a ``404`` response.
         
        """
        client = await spawn_client()

        resp = await client.get("/api/viruses/6116cba1/isolates")

        assert await resp_is.not_found(resp)


class TestGetIsolate:

    async def test(self, spawn_client, test_virus, test_sequence):
        """
        Test that an existing isolate is successfully returned.
         
        """
        client = await spawn_client()

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        resp = await client.get("/api/viruses/6116cba1/isolates/cab8b360")

        assert resp.status == 200

        test_sequence["id"] = test_sequence.pop("_id")
        del test_sequence["virus_id"]
        del test_sequence["isolate_id"]

        assert await resp.json() == {
            "default": True,
            "source_type": "isolate",
            "source_name": "8816-v2",
            "id": "cab8b360",
            "sequences": [test_sequence]
        }

    @pytest.mark.parametrize("virus_id,isolate_id", [
        ("foobar", "cab8b360"),
        ("6116cba1", "foobar"),
        ("6116cba1", "cab8b360")
    ])
    async def test_not_found(self, virus_id, isolate_id, spawn_client, resp_is):
        """
        Test that a ``404`` response results for a non-existent virus and/or isolate.
         
        """
        client = await spawn_client()

        resp = await client.get("/api/viruses/{}/isolates/{}".format(virus_id, isolate_id))

        assert await resp_is.not_found(resp)


class TestAddIsolate:

    async def test_is_default(self, monkeypatch, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that a new default isolate can be added, setting ``default`` to ``False`` on all other isolates in the
        process.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": True
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.post("/api/viruses/6116cba1/isolates", data)

        assert resp.status == 201

        assert await resp.json() == {
            "id": "test",
            "source_type": "isolate",
            "source_name": "b",
            "default": True,
            "sequences": []
        }

        new = await client.db.viruses.find_one("6116cba1")

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
            "Added isolate Isolate b as default",
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

    async def test_not_default(self, monkeypatch, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that a non-default isolate can be properly added
        
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.post("/api/viruses/6116cba1/isolates", data)

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": "test",
            "default": False,
            "sequences": []
        }

        new = await client.db.viruses.find_one("6116cba1")

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
            "Added isolate Isolate b",
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

    async def test_first(self, monkeypatch, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that the first isolate for a virus is set as the ``default`` virus even if ``default`` is set to ``False``
        in the POST input.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["isolates"] = []

        await client.db.viruses.insert_one(test_virus)

        async def get_fake_id(*args):
            return "test"

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        }

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.post("/api/viruses/6116cba1/isolates", data)

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": "test",
            "default": True,
            "sequences": []
        }

        new = await client.db.viruses.find_one("6116cba1")

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
            "Added isolate Isolate b as default",
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

    async def test_force_case(self, monkeypatch, spawn_client, test_virus, test_dispatch):
        """
        Test that the ``source_type`` value is forced to lower case.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_name": "Beta",
            "source_type": "Isolate",
            "default": False
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.post("/api/viruses/6116cba1/isolates", data)

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "Beta",
            "source_type": "isolate",
            "id": "test",
            "default": False,
            "sequences": []
        }

        document = await client.db.viruses.find_one("6116cba1")

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

    async def test_empty(self, monkeypatch, spawn_client, test_virus, test_dispatch):
        """
        Test that an isolate can be added without any POST input. The resulting document should contain the defined
        default values.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.post("/api/viruses/6116cba1/isolates", {})

        assert resp.status == 201

        assert await resp.json() == {
            "id": "test",
            "source_name": "",
            "source_type": "",
            "default": False,
            "sequences": []
        }

        assert (await client.db.viruses.find_one("6116cba1", ["isolates"]))["isolates"] == [
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

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        data = {
            "source_name": "Beta",
            "source_type": "Isolate",
            "default": False
        }

        resp = await client.post("/api/viruses/6116cba1/isolates", data)

        assert await resp_is.not_found(resp)


class TestEditIsolate:

    @pytest.mark.parametrize("data,description", [
        ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
        ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
        ({"source_type": "variant", "source_name": "A"}, "Renamed Isolate b to Variant A"),
        ({"source_name": "A"}, "Renamed Isolate b to Isolate A")
    ])
    async def test(self, data, description, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.viruses.insert_one(test_virus)

        resp = await client.patch("/api/viruses/6116cba1/isolates/test", data)

        assert resp.status == 200

        expected = dict(test_virus["isolates"][1])

        expected.update(data)

        assert await resp.json() == dict(expected, sequences=[])

        new = await client.db.viruses.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            expected
        ]

        for joined in (test_virus, new):
            for isolate in joined["isolates"]:
                isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit_isolate",
            test_virus,
            new,
            description,
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

    async def test_force_case(self, monkeypatch, spawn_client, test_virus, test_dispatch):
        """
        Test that the ``source_type`` value is forced to lower case.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_type": "Variant",
        }

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.virus.get_new_isolate_id", get_fake_id)

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360", data)

        assert resp.status == 200

        expected = {
            "id": "cab8b360",
            "default": True,
            "source_type": "variant",
            "source_name": "8816-v2",
            "sequences": []
        }

        assert await resp.json() == expected

        del expected["sequences"]

        assert (await client.db.viruses.find_one("6116cba1", ["isolates"]))["isolates"] == [expected]

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

    async def test_empty(self, spawn_client, test_dispatch, resp_is):
        """
        Test that an empty data input results in a ``400`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360", {})

        assert resp.status == 400

        assert await resp_is.bad_request(resp, "Empty Input")

        assert test_dispatch.stub.call_args is None

    async def test_invalid_input(self, spawn_client, test_virus, resp_is):
        """
        Test that invalid input results in a ``422`` response and a list of errors.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_type": {"key": "variant"},
            "source_name": "A"
        }

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360", data)

        assert await resp_is.invalid_input(resp, {
            "source_type": ["must be of string type"]
        })

    @pytest.mark.parametrize("virus_id,isolate_id", [
        ("6116cba1", "test"),
        ("test", "cab8b360"),
        ("test", "test")
    ])
    async def test_not_found(self, virus_id, isolate_id, spawn_client, test_virus, resp_is):
        """
        Test that a request for a non-existent virus or isolate results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "source_type": "variant",
            "source_name": "A"
        }

        resp = await client.patch("/api/viruses/{}/isolates/{}".format(virus_id, isolate_id), data)

        assert await resp_is.not_found(resp)


class TestSetAsDefault:

    async def test(self, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test changing the default isolate results in the correct changes, history, and response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])
        
        test_virus["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.viruses.insert_one(test_virus)

        resp = await client.put("/api/viruses/6116cba1/isolates/test/default", {})

        assert resp.status == 200

        assert await resp.json() == {
            "id": "test",
            "source_type": "isolate",
            "source_name": "b",
            "default": True,
            "sequences": []
        }

        new = await virtool.virus.join(client.db, "6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": True,
                "sequences": []
            }
        ]

        for joined in (test_virus, new):
            for isolate in joined["isolates"]:
                isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "set_as_default",
            test_virus,
            new,
            "Set Isolate b as default",
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

    async def test_no_change(self, spawn_client, test_virus, test_add_history, test_dispatch):
        """
        Test that a call resulting in no change (calling endpoint on an already default isolate) results in no change.
        Specifically no increment in version and no dispatch.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])
        
        test_virus["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.viruses.insert_one(test_virus)

        resp = await client.put("/api/viruses/6116cba1/isolates/cab8b360/default", {})

        assert resp.status == 200

        assert await resp.json() == {
            "id": "cab8b360",
            "default": True,
            "source_type": "isolate",
            "source_name": "8816-v2",
            "sequences": []
        }

        new = await virtool.virus.join(client.db, "6116cba1")

        assert new["version"] == 0

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False,
                "sequences": []
            }
        ]

        assert not test_add_history.called

        assert not test_dispatch.stub.called

    @pytest.mark.parametrize("virus_id,isolate_id", [
        ("6116cba1", "test"),
        ("test", "cab8b360"),
        ("test", "test")
    ])
    async def test_not_found(self, virus_id, isolate_id, spawn_client, test_virus, resp_is):
        """
        Test that ``404 Not found`` is returned if the virus or isolate does not exist

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        resp = await client.put("/api/viruses/{}/isolates/{}/default".format(virus_id, isolate_id), {})

        assert await resp_is.not_found(resp)


class TestRemoveIsolate:

    async def test(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a valid request results in a ``204`` response and the isolate and sequence data is removed from the
        database.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        assert await client.db.viruses.find({"isolates.id": "cab8b360"}).count() == 1

        resp = await client.delete("/api/viruses/6116cba1/isolates/cab8b360")

        assert resp.status == 204

        assert await client.db.viruses.find({"isolates.id": "cab8b360"}).count() == 0

        assert await client.db.sequences.count() == 0

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
            "Removed Isolate 8816-v2",
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

    async def test_change_default(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        """
        Test that a valid request results in a ``204`` response and ``default`` status is reassigned correctly.

        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        resp = await client.delete("/api/viruses/6116cba1/isolates/cab8b360")

        assert resp.status == 204

        assert await client.db.viruses.find({"isolates.id": "cab8b360"}).count() == 0

        assert (await client.db.viruses.find_one({"isolates.id": "bcb9b352"}, ["isolates"]))["isolates"][0]["default"]

        assert not await client.db.sequences.count()

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
            "Removed Isolate 8816-v2 and set Isolate 7865 as default",
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
    async def test_not_found(self, url, spawn_client, test_virus, resp_is):
        """
        Test that removal fails with ``404`` if the virus does not exist.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        resp = await client.delete(url)

        assert await resp_is.not_found(resp)


class TestListSequences:

    async def test(self, spawn_client, test_virus, test_sequence):
        client = await spawn_client()

        await client.db.viruses.insert(test_virus)
        await client.db.sequences.insert(test_sequence)

        resp = await client.get("/api/viruses/6116cba1/isolates/cab8b360/sequences")

        assert resp.status == 200

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
    async def test_not_found(self, url, spawn_client, resp_is):
        """
        Test that ``404`` is returned when the isolate id or sequence id do not exist.

        """
        client = await spawn_client()

        resp = await client.get(url)

        assert await resp_is.not_found(resp)


class TestGetSequence:

    async def test(self, spawn_client, test_virus, test_sequence):
        client = await spawn_client()

        await client.db.viruses.insert(test_virus)
        await client.db.sequences.insert(test_sequence)

        resp = await client.get("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872")

        assert resp.status == 200

        test_sequence["id"] = test_sequence.pop("_id")

        assert await resp.json() == test_sequence

    @pytest.mark.parametrize("url", [
        "/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872",
        "/api/viruses/6116cba1/isolates/cab8b360/sequences/foobar",
        "/api/viruses/6116cba1/isolates/foobar/sequences/KX269872",
        "/api/viruses/foobar/isolates/cab8b360/sequences/KX269872",
    ])
    async def test_not_found(self, url, spawn_client, resp_is):
        client = await spawn_client()

        resp = await client.get(url)

        assert await resp_is.not_found(resp)


class TestCreateSequence:

    async def test(self, spawn_client, test_virus, test_add_history, test_dispatch):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)

        data = {
            "id": "foobar",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        resp = await client.post("/api/viruses/6116cba1/isolates/cab8b360/sequences", data)

        data.update({
            "isolate_id": "cab8b360",
            "virus_id": "6116cba1"
        })

        assert resp.status == 200

        assert await resp.json() == {
            "id": "foobar",
            "definition": "A made up sequence",
            "virus_id": "6116cba1",
            "isolate_id": "cab8b360",
            "host": "Plant",
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
            "_id": "foobar",
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
            "Created new sequence foobar in Isolate 8816-v2",
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

    async def test_exists(self, spawn_client, test_virus, test_sequence, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert(test_virus)
        await client.db.sequences.insert(test_sequence)

        resp = await client.post("/api/viruses/6116cba1/isolates/cab8b360/sequences", {
            "id": "KX269872",
            "sequence": "ATGCGTGTACTG",
            "definition": "An already existing sequence"
        })

        assert await resp_is.conflict(resp, "Sequence id already exists")

    async def test_invalid_input(self, spawn_client, resp_is):
        """
        Test that invalid input results in a ``422`` response with error information.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.post("/api/viruses/6116cba1/isolates/cab8b360/sequences", {
            "id": 2016,
            "seq": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        })

        assert await resp_is.invalid_input(resp, {
            "id": ["must be of string type"],
            "sequence": ["required field"],
            "seq": ["unknown field"]
        })

    @pytest.mark.parametrize("virus_id, isolate_id", [
        ("6116cba1", "cab8b360"),
        ("6116cba1", "foobar"),
        ("foobar", "cab8b360")
    ])
    async def test_not_found(self, virus_id, isolate_id, spawn_client, resp_is):
        """
        Test that non-existent virus or isolate ids in the URL result in a ``404`` response.
         
        """
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        data = {
            "id": "FOOBAR",
            "host": "Plant",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        url = "/api/viruses/{}/isolates/{}/sequences".format(virus_id, isolate_id)

        resp = await client.post(url, data)

        assert await resp_is.not_found(resp)


class TestEditSequence:

    async def test(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert(test_virus)
        await client.db.sequences.insert(test_sequence)

        data = {
            "host": "Grapevine",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        }

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872", data)

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
            "Edited sequence KX269872 in Isolate 8816-v2",
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

    async def test_empty_input(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872", {})

        assert resp.status == 400

        assert await resp_is.bad_request(resp, "Empty Input")

    async def test_invalid_input(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        resp = await client.patch("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872", {
            "plant": "Grapevine",
            "sequence": "ATGCGTGTACTG",
            "definition": 123
        })

        assert resp.status == 422

        assert await resp_is.invalid_input(resp, {
            "definition": ["must be of string type"],
            "plant": ["unknown field"]
        })

    @pytest.mark.parametrize("foobar", ["virus_id", "isolate_id", "sequence_id"])
    async def test_not_found(self, foobar, spawn_client, test_virus, test_sequence, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert(test_virus)
        await client.db.sequences.insert(test_sequence)

        url = "/api/viruses/{}/isolates/{}/sequences/{}".format(
            "foobar" if foobar == "virus_id" else "6116cba1",
            "foobar" if foobar == "isolate_id" else "cab8b360",
            "foobar" if foobar == "sequence_id" else "KX269872"
        )

        resp = await client.patch(url, {
            "host": "Grapevine",
            "sequence": "ATGCGTGTACTG",
            "definition": "A made up sequence"
        })

        assert resp.status == 404

        if foobar == "sequence_id":
            assert await resp_is.not_found(resp, "Sequence not found")
        else:
            assert await resp_is.not_found(resp, "Virus or isolate not found")


class TestRemoveSequence:

    async def test(self, spawn_client, test_virus, test_sequence, test_add_history, test_dispatch):
        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.viruses.insert_one(test_virus)
        await client.db.sequences.insert_one(test_sequence)

        old = await virtool.virus.join(client.db, test_virus["_id"])

        resp = await client.delete("/api/viruses/6116cba1/isolates/cab8b360/sequences/KX269872")

        new = await virtool.virus.join(client.db, test_virus["_id"])

        assert test_add_history.call_args[0][1:] == (
            "remove_sequence",
            old,
            new,
            "Removed sequence KX269872 from Isolate 8816-v2",
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

        assert resp.status == 204

    @pytest.mark.parametrize("virus_id,isolate_id,sequence_id", [
        ("test", "cab8b360", "KX269872"),
        ("6116cba1", "test", "KX269872"),
        ("6116cba1", "cab8b360", "test"),
        ("test", "test", "KX269872"),
        ("6116cba1", "test", "test"),
        ("test", "test", "test")
    ])
    async def test_virus_not_found(self, virus_id, isolate_id, sequence_id, test_virus, test_sequence,
                                   spawn_client, resp_is):

        client = await spawn_client(authorize=True, permissions=["modify_virus"])

        await client.db.sequences.insert_one(test_virus)
        await client.db.viruses.insert_one(test_sequence)

        resp = await client.delete("/api/viruses/{}/isolates/{}/sequences/{}".format(virus_id, isolate_id, sequence_id))

        await resp_is.not_found(resp)
