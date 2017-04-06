from virtool.viruses import dispatch_processor


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
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

        resp = await do_get("/api/viruses/" + test_virus["_id"])

        assert resp.status == 200

        assert await resp.json() == test_merged_virus

    async def test_no_sequences(self, test_db, do_get, test_virus, test_merged_virus):
        test_db.viruses.insert(test_virus)

        resp = await do_get("/api/viruses/" + test_virus["_id"])

        assert resp.status == 200

        test_merged_virus["isolates"][0]["sequences"] = []

        assert await resp.json() == test_merged_virus

    async def test_not_found(self, do_get):
        resp = await do_get("/api/viruses/foobar")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestCreate:

    async def test_valid(self, monkeypatch, test_db, do_post):
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
            "user_id": "test",
            "name": "Tobacco mosaic virus",
            "isolates": [],
            "last_indexed_version": None,
            "modified": True,
            "abbreviation": "TMV"
        }

        assert await resp.json() == expected

        expected["_id"] = expected.pop("virus_id")

        assert test_db.viruses.find_one() == expected

    async def test_invalid_input(self, do_post):
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
        test_db.viruses.insert({
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
        test_db.viruses.insert({
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
        test_db.viruses.insert({
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

    async def test_not_authorized(self, do_post):
        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_post):
        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await do_post("/api/viruses", data, authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }


class TestRemove:

    async def test(self, test_db, do_delete, test_virus):
        """
        Test that an existing virus can be removed.        
         
        """
        test_db.viruses.insert(test_virus)

        assert test_db.viruses.find({"_id": "6116cba1"}).count()

        resp = await do_delete("/api/viruses/6116cba1", authorize=True, permissions=["modify_virus"])

        assert resp.status == 200

        assert await resp.json() == {
            "removed": "6116cba1"
        }

        assert test_db.viruses.find({"_id": "6116cba1"}).count() == 0

    async def test_does_not_exist(self, do_delete):
        """
        Test that attempting to remove a non-existent virus results in a ``404`` response. 
        """
        resp = await do_delete("/api/viruses/6116cba1", authorize=True, permissions=["modify_virus"])

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }

    async def test_not_authorized(self, do_delete):
        resp = await do_delete("/api/viruses/6116cba1", {})

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_delete):
        resp = await do_delete("/api/viruses/6116cba1", authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }


class TestListIsolates:

    async def test(self, test_db, do_get, test_virus):
        test_virus["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "isolate_id": "bcb9b352"
        })

        test_db.viruses.insert(test_virus)

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
        resp = await do_get("/api/viruses/6116cba1/isolates")

        assert resp.status == 404

        assert await resp.json() == {
            "message": "Not found"
        }


class TestGetIsolate:

    async def test(self, test_db, do_get, test_virus, test_sequence):
        test_db.viruses.insert(test_virus)
        test_db.sequences.insert(test_sequence)

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

    async def test_is_default(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that a new default isolate can be added, setting ``default`` to ``False`` on all other isolates in the
        process.
         
        """
        test_db.viruses.insert(test_virus)

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
            "default": True,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "isolate_id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": True,
                "sequences": []
            }
        ]

    async def test_not_default(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that a non-default isolate can be properly added
        
        """
        test_db.viruses.insert(test_virus)

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
            "default": False,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "isolate_id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False,
                "sequences": []
            }
        ]

    async def test_first(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that the first isolate for a virus is set as the ``default`` virus even if ``default`` is set to ``False``
        in the POST input.

        """
        test_virus["isolates"] = []

        test_db.viruses.insert(test_virus)

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
            "default": True,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": True,
                "sequences": []
            }
        ]

    async def test_force_case(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that the ``source_type`` value is forced to lower case.
         
        """
        test_db.viruses.insert(test_virus)

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
            "default": False,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "isolate_id": "test",
                "source_name": "Beta",
                "source_type": "isolate",
                "default": False,
                "sequences": []
            }
        ]

    async def test_empty(self, monkeypatch, test_db, do_post, test_virus):
        """
        Test that an isolate can be added without any POST input. The resulting document should contain the defined
        default values.
         
        """
        test_db.viruses.insert(test_virus)

        async def get_fake_id(*args):
            return "test"

        monkeypatch.setattr("virtool.viruses.get_new_isolate_id", get_fake_id)

        resp = await do_post("/api/viruses/6116cba1/isolates", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 201

        assert await resp.json() == {
            "source_name": "",
            "source_type": "",
            "isolate_id": "test",
            "default": False,
            "sequences": []
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "isolate_id": "test",
                "source_name": "",
                "source_type": "",
                "default": False,
                "sequences": []
            }
        ]

    async def test_not_authorized(self, do_post):
        resp = await do_post("/api/viruses/6116cba1/isolates", {})

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_post):
        resp = await do_post("/api/viruses/6116cba1/isolates", {}, authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }


class TestEditIsolate:

    async def test(self, test_db, do_patch, test_virus):
        """
        Test that the isolate can be edited such that it is the default isolate and all other isolates are set with
        ``default`` to ``False``.

        """
        test_virus["isolates"].append({
            "isolate_id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False,
            "sequences": []
        })

        test_db.viruses.insert(test_virus)

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
            "sequences": [],
            "default": True
        }

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [
            {
                "isolate_id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2",
                "sequences": []
            },
            {
                "isolate_id": "test",
                "source_name": "b",
                "source_type": "variant",
                "default": True,
                "sequences": []
            }
        ]

    async def test_unset_default(self, test_db, do_patch, test_virus):
        """
        Test that attempting to set ``default`` to ``False`` for a default isolate results in a ``400`` response. The
        appropriate way to change the default isolate is to set ``default`` to ``True`` on another isolate.

        """
        test_db.viruses.insert(test_virus)

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
        test_db.viruses.insert(test_virus)

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
            "source_name": "8816-v2",
            "sequences": []
        }

        assert await resp.json() == expected

        assert test_db.viruses.find_one("6116cba1", ["isolates"])["isolates"] == [expected]

    async def test_empty(self, do_patch):
        """
        Test that an empty data input results in a ``400`` response.

        """
        resp = await do_patch("/api/viruses/6116cba1/isolates/cab8b360", {}, authorize=True, permissions=["modify_virus"])

        assert resp.status == 400

        assert await resp.json() == {
            "message": "Empty input"
        }

    async def test_not_authorized(self, do_patch):
        resp = await do_patch("/api/viruses/6116cba1/isolates/test", {})

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not authorized"
        }

    async def test_not_permitted(self, do_patch):
        resp = await do_patch("/api/viruses/6116cba1/isolates/test", {}, authorize=True)

        assert resp.status == 403

        assert await resp.json() == {
            "message": "Not permitted"
        }
