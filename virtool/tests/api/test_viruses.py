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

        assert resp.status == 200

        assert await resp.json() == dict(data, virus_id="test", user_id="test")

        assert test_db.viruses.find_one() == dict(data, _id="test", user_id="test")

    async def test_invalid_input(self, do_post):
        data = {
            "virus_name": "Tobacco mosaic virus",
            "abbreviation": 123
        }

        resp = await do_post("/api/viruses", data, authorize=True, permissions=["modify_virus"])

        assert resp.status == 422

        assert await resp.json() == {
            'message': 'Invalid input',
            'errors': {
                'virus_name': ['unknown field'],
                'abbreviation': ['must be of string type'],
                'name': ['required field']
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
