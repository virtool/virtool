import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.otus.db
import virtool.otus.utils


@pytest.mark.parametrize("find", [None, "tobacco"])
@pytest.mark.parametrize("verified", [None, True, False])
@pytest.mark.parametrize("names", [None, True, False])
async def test_find(find, verified, names, mocker, spawn_client, test_otu):
    """
    Test that OTUs can be found be `find` and `verified` fields. Ensure names returns a list of names and ids.

    """
    client = await spawn_client(authorize=True)

    result = {
        "documents": [test_otu]
    }

    m = mocker.patch("virtool.otus.db.find", make_mocked_coro(result))

    params = {}

    if find is not None:
        params["find"] = find

    for key, value in [("names", names), ("verified", verified)]:
        if value is not None:
            params[key] = str(value)

    resp = await client.get("/api/otus", params=params)

    assert resp.status == 200

    assert await resp.json() == result

    m.assert_called_with(
        client.db,
        names or False,
        find,
        mocker.ANY,
        verified
    )


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, spawn_client, resp_is, test_otu, test_sequence):
    """
    Test that a valid request returns a complete otu document.

    """
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.otus.insert_one(test_otu)

    await client.db.sequences.insert_one(test_sequence)

    resp = await client.get("/api/otus/6116cba1")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json())


class TestCreate:

    @pytest.mark.parametrize("exists", [True, False])
    @pytest.mark.parametrize("abbreviation", [None, "", "TMV"])
    async def test(self, exists, abbreviation, mocker, snapshot, spawn_client, check_ref_right, resp_is, static_time,
                   test_random_alphanumeric):
        """
        Test that a valid request results in the creation of a otu document and a ``201`` response.

        """
        client = await spawn_client(authorize=True)

        if exists:
            await client.db.references.insert_one({
                "_id": "foo"
            })

        # Pass ref exists check.
        mocker.patch("virtool.db.utils.id_exists", make_mocked_coro(False))

        data = {
            "name": "Tobacco mosaic virus"
        }

        if abbreviation is not None:
            data["abbreviation"] = abbreviation

        resp = await client.post("/api/refs/foo/otus", data)

        if not exists:
            assert await resp_is.not_found(resp)
            return

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == "/api/otus/9pfsom1b"

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one(), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    @pytest.mark.parametrize("error,message", [
        (None, None),
        ("400_name_exists", "Name already exists"),
        ("400_abbr_exists", "Abbreviation already exists"),
        ("400_both_exist", "Name and abbreviation already exist"),
        ("404", None)
    ])
    async def test_field_exists(self, error, message, mocker, spawn_client, check_ref_right, resp_is):
        """
        Test that the request fails with ``409 Conflict`` if the requested otu name already exists.

        """
        # Pass ref exists check.
        mocker.patch("virtool.db.utils.id_exists", make_mocked_coro(True))

        # Pass name and abbreviation check.
        m_check_name_and_abbreviation = mocker.patch(
            "virtool.otus.db.check_name_and_abbreviation",
            make_mocked_coro(message)
        )

        client = await spawn_client(authorize=True)

        if error != "404":
            await client.db.references.insert_one({
                "_id": "foo"
            })

        data = {
            "name": "Tobacco mosaic virus",
            "abbreviation": "TMV"
        }

        resp = await client.post("/api/refs/foo/otus", data)

        if error == "404":
            assert await resp_is.not_found(resp)
            return

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        # Abbreviation defaults to empty string for OTU creation.
        m_check_name_and_abbreviation.assert_called_with(
            client.db,
            "foo",
            "Tobacco mosaic virus",
            "TMV"
        )

        if error:
            assert resp.status == 400
            assert await resp.json() == {
                "id": "bad_request",
                "message": message
            }
            return

        assert resp.status == 201


class TestEdit:

    @pytest.mark.parametrize("data, existing_abbreviation, description", [
        # Name, ONLY.
        (
                {
                    "name": "Tobacco mosaic otu"
                },
                "TMV",
                "Changed name to Tobacco mosaic otu"
        ),
        # Name and abbreviation, BOTH CHANGE.
        (
                {
                    "name": "Tobacco mosaic otu",
                    "abbreviation": "TMV"
                },
                "PVF",
                "Changed name to Tobacco mosaic otu and changed abbreviation to TMV"
        ),
        # Name and abbreviation, NO NAME CHANGE because old is same as new.
        (
                {
                    "name": "Prunus virus F",
                    "abbreviation": "TMV"
                },
                "PVF",
                "Changed abbreviation to TMV"
        ),
        # Name and abbreviation, NO ABBR CHANGE because old is same as new.
        (
                {
                    "name": "Tobacco mosaic otu",
                    "abbreviation": "TMV"
                },
                "TMV",
                "Changed name to Tobacco mosaic otu"
        ),
        # Name and abbreviation, ABBR REMOVED because old is "TMV" and new is "".
        (
                {
                    "name": "Tobacco mosaic otu",
                    "abbreviation": ""
                },
                "TMV",
                "Changed name to Tobacco mosaic otu and removed abbreviation TMV"
        ),
        # Name and abbreviation, ABBR ADDED because old is "" and new is "TMV".
        (
                {
                    "name": "Tobacco mosaic otu",
                    "abbreviation": "TMV"
                },
                "",
                "Changed name to Tobacco mosaic otu and added abbreviation TMV"
        ),
        # Abbreviation, ONLY.
        (
                {
                    "abbreviation": "TMV"
                },
                "PVF",
                "Changed abbreviation to TMV"
        ),
        # Abbreviation, ONLY because old name is same as new.
        (
                {
                    "name": "Prunus virus F",
                    "abbreviation": "TMV"
                },
                "PVF",
                "Changed abbreviation to TMV"
        ),
        # Abbreviation, ADDED.
        (
                {
                    "abbreviation": "TMV"
                },
                "",
                "Added abbreviation TMV"
        ),
        # Abbreviation, REMOVED.
        (
                {
                    "abbreviation": ""
                },
                "TMV",
                "Removed abbreviation TMV"
        )
    ])
    async def test(self, data, existing_abbreviation, description, snapshot, spawn_client, check_ref_right, resp_is,
                   test_otu):
        """
        Test that changing the name and abbreviation results in changes to the otu document and a new change
        document in history. The that change both fields or one or the other results in the correct changes and
        history record.

        """
        client = await spawn_client(authorize=True)

        test_otu["abbreviation"] = existing_abbreviation

        await client.db.otus.insert_one(test_otu)

        resp = await client.patch("/api/otus/6116cba1", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one(), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    @pytest.mark.parametrize("data,message", [
        (
                {
                    "name": "Tobacco mosaic virus",
                    "abbreviation": "FBV"
                },
                "Name already exists"
        ),
        (
                {
                    "name": "Foobar virus",
                    "abbreviation": "TMV"
                },
                "Abbreviation already exists"
        ),
        (
                {
                    "name": "Tobacco mosaic virus",
                    "abbreviation": "TMV"
                },
                "Name and abbreviation already exist"
        )
    ])
    async def test_field_exists(self, data, message, spawn_client, check_ref_right, resp_is):
        """
        Test that the request fails with ``409 Conflict`` if the requested name or abbreviation already exists.

        """
        client = await spawn_client(authorize=True)

        await client.db.otus.insert_many([
            {
                "_id": "test",
                "name": "Prunus virus F",
                "lower_name": "prunus virus f",
                "isolates": [],
                "reference": {
                    "id": "foo"
                }
            },
            {
                "_id": "conflict",
                "name": "Tobacco mosaic virus",
                "abbreviation": "TMV",
                "lower_name": "tobacco mosaic virus",
                "isolates": [],
                "reference": {
                    "id": "foo"
                }
            }
        ])

        resp = await client.patch("/api/otus/test", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return
        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": message
        }

    @pytest.mark.parametrize("old_name,old_abbreviation,data", [
        (
                "Tobacco mosaic otu",
                "TMV",
                {
                    "name": "Tobacco mosaic otu",
                    "abbreviation": "TMV"
                }
        ),
        (
                "Tobacco mosaic otu",
                "TMV",
                {
                    "name": "Tobacco mosaic otu"
                }
        ),
        (
                "Tobacco mosaic otu",
                "TMV",
                {
                    "abbreviation": "TMV"
                }
        )
    ])
    async def test_no_change(self, old_name, old_abbreviation, data, snapshot, spawn_client, check_ref_right, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one({
            "_id": "test",
            "name": old_name,
            "lower_name": "tobacco mosaic otu",
            "abbreviation": old_abbreviation,
            "isolates": [],
            "reference": {
                "id": "foo"
            }
        })

        resp = await client.patch("/api/otus/test", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        snapshot.assert_match(await resp.json())
        assert await client.db.history.count_documents({}) == 0

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        data = {
            "name": "Tobacco mosaic otu",
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/otus/test", data)

        assert await resp_is.not_found(resp)


@pytest.mark.parametrize("abbreviation,exists", [("", True), ("PVF", True), ("", False)])
async def test_remove(abbreviation, exists, snapshot, spawn_client, check_ref_right, resp_is, test_otu):
    """
    Test that an existing otu can be removed.

    """
    client = await spawn_client(authorize=True, permissions=["modify_otu"])

    test_otu["abbreviation"] = abbreviation

    if exists:
        await client.db.otus.insert_one(test_otu)

    old = await client.db.otus.find_one("6116cba1")

    resp = await client.delete("/api/otus/6116cba1")

    if not exists:
        assert old is None
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)
    assert await client.db.otus.count_documents({"_id": "6116cba1"}) == 0
    snapshot.assert_match(await client.db.history.find_one(), "history")


@pytest.mark.parametrize("error", [None, "404"])
async def test_list_isolates(error, snapshot, spawn_client, resp_is, test_otu):
    """
    Test the isolates are properly listed and formatted for an existing otu.

    """
    client = await spawn_client(authorize=True)

    if not error:
        test_otu["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        await client.db.otus.insert_one(test_otu)

    resp = await client.get("/api/otus/6116cba1/isolates")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json(), "json")


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_get_isolate(error, snapshot, spawn_client, resp_is, test_otu, test_sequence):
    """
    Test that an existing isolate is successfully returned.

    """
    client = await spawn_client(authorize=True)

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    await client.db.sequences.insert_one(test_sequence)

    resp = await client.get("/api/otus/6116cba1/isolates/cab8b360")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json())


class TestAddIsolate:

    @pytest.mark.parametrize("default", [True, False])
    async def test_default(self, default, mocker, snapshot, spawn_client, check_ref_right, resp_is, test_otu,
                           test_random_alphanumeric):
        """
        Test that a new default isolate can be added, setting ``default`` to ``False`` on all other isolates in the
        process.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": default
        }

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/api/otus/6116cba1/isolates", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == f"/api/otus/6116cba1/isolates/{test_random_alphanumeric.history[0]}"

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_first(self, mocker, snapshot, spawn_client, check_ref_right, resp_is, test_otu,
                         test_random_alphanumeric):
        """
        Test that the first isolate for a otu is set as the ``default`` otu even if ``default`` is set to ``False``
        in the POST input.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        test_otu["isolates"] = []

        await client.db.otus.insert_one(test_otu)

        data = {
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        }

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/api/otus/6116cba1/isolates", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == f"/api/otus/6116cba1/isolates/{test_random_alphanumeric.history[0]}"

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_force_case(self, mocker, snapshot, spawn_client, check_ref_right, resp_is, test_otu,
                              test_random_alphanumeric):
        """
        Test that the ``source_type`` value is forced to lower case.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        data = {
            "source_name": "Beta",
            "source_type": "Isolate",
            "default": False
        }

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/api/otus/6116cba1/isolates", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == f"/api/otus/6116cba1/isolates/{test_random_alphanumeric.history[0]}"

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_empty(self, mocker, snapshot, spawn_client, check_ref_right, resp_is, test_otu,
                         test_random_alphanumeric):
        """
        Test that an isolate can be added without any POST input. The resulting document should contain the defined
        default values.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/api/otus/6116cba1/isolates", {})

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == f"/api/otus/6116cba1/isolates/{test_random_alphanumeric.history[0]}"

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        data = {
            "source_name": "Beta",
            "source_type": "Isolate",
            "default": False
        }

        resp = await client.post("/api/otus/6116cba1/isolates", data)

        assert await resp_is.not_found(resp)


class TestEditIsolate:

    @pytest.mark.parametrize("data,description", [
        ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
        ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
        ({"source_type": "variant", "source_name": "A"}, "Renamed Isolate b to Variant A"),
        ({"source_name": "A"}, "Renamed Isolate b to Isolate A")
    ])
    async def test(self, data, description, snapshot, spawn_client, check_ref_right, resp_is, test_otu):
        """
        Test that a change to the isolate name results in the correct changes, history, and response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        test_otu["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.otus.insert_one(test_otu)

        await client.db.references.insert_one({
            "_id": "hxn167",
            "restrict_source_types": False,
            "source_types": [
                "isolate"
            ]
        })

        resp = await client.patch("/api/otus/6116cba1/isolates/test", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_force_case(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu):
        """
        Test that the ``source_type`` value is forced to lower case.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        await client.db.references.insert_one({
            "_id": "hxn167",
            "restrict_source_types": False,
            "source_types": [
                "isolate"
            ]
        })

        data = {
            "source_type": "Variant",
        }

        resp = await client.patch("/api/otus/6116cba1/isolates/cab8b360", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    @pytest.mark.parametrize("otu_id,isolate_id", [
        ("6116cba1", "test"),
        ("test", "cab8b360"),
        ("test", "test")
    ])
    async def test_not_found(self, otu_id, isolate_id, spawn_client, test_otu, resp_is):
        """
        Test that a request for a non-existent otu or isolate results in a ``404`` response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        data = {
            "source_type": "variant",
            "source_name": "A"
        }

        resp = await client.patch("/api/otus/{}/isolates/{}".format(otu_id, isolate_id), data)

        assert await resp_is.not_found(resp)


class TestSetAsDefault:

    async def test(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_random_alphanumeric,
                   static_time):
        """
        Test changing the default isolate results in the correct changes, history, and response.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        test_otu["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.otus.insert_one(test_otu)

        resp = await client.put("/api/otus/6116cba1/isolates/test/default", {})

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200

        new = await virtool.otus.db.join(client.db, "6116cba1")

        snapshot.assert_match(await resp.json(), "json")
        snapshot.assert_match(new, "joined")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_no_change(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, static_time,
                             test_random_alphanumeric):
        """
        Test that a call resulting in no change (calling endpoint on an already default isolate) results in no change.
        Specifically no increment in version.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        test_otu["isolates"].append({
            "id": "test",
            "source_name": "b",
            "source_type": "isolate",
            "default": False
        })

        await client.db.otus.insert_one(test_otu)

        resp = await client.put("/api/otus/6116cba1/isolates/cab8b360/default", {})

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200

        snapshot.assert_match(await resp.json(), "response")

        new = await virtool.otus.db.join(client.db, "6116cba1")

        snapshot.assert_match(new, "joined")

        assert await client.db.history.count_documents({}) == 0

    @pytest.mark.parametrize("otu_id,isolate_id", [
        ("6116cba1", "test"),
        ("test", "cab8b360"),
        ("test", "test")
    ])
    async def test_not_found(self, otu_id, isolate_id, spawn_client, test_otu, resp_is):
        """
        Test that ``404 Not found`` is returned if the otu or isolate does not exist

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        resp = await client.put(f"/api/otus/{otu_id}/isolates/{isolate_id}/default", {})

        assert await resp_is.not_found(resp)


class TestRemoveIsolate:

    async def test(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_sequence):
        """
        Test that a valid request results in a ``204`` response and the isolate and sequence data is removed from the
        database.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)
        await client.db.sequences.insert_one(test_sequence)

        assert await client.db.otus.count_documents({"isolates.id": "cab8b360"}) == 1

        resp = await client.delete("/api/otus/6116cba1/isolates/cab8b360")

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        await resp_is.no_content(resp)
        assert await client.db.otus.count_documents({"isolates.id": "cab8b360"}) == 0
        assert await client.db.sequences.count_documents({}) == 0

        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_change_default(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_sequence):
        """
        Test that a valid request results in a ``204`` response and ``default`` status is reassigned correctly.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        test_otu["isolates"].append({
            "default": False,
            "source_type": "isolate",
            "source_name": "7865",
            "id": "bcb9b352"
        })

        await client.db.otus.insert_one(test_otu)
        await client.db.sequences.insert_one(test_sequence)

        resp = await client.delete("/api/otus/6116cba1/isolates/cab8b360")

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        await resp_is.no_content(resp)
        assert await client.db.otus.count_documents({"isolates.id": "cab8b360"}) == 0
        assert not await client.db.sequences.count_documents({})

        snapshot.assert_match(await client.db.otus.find_one({"isolates.id": "bcb9b352"}), "otu")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    @pytest.mark.parametrize("url", ["/api/otus/foobar/isolates/cab8b360", "/api/otus/test/isolates/foobar"])
    async def test_not_found(self, url, spawn_client, test_otu, resp_is):
        """
        Test that removal fails with ``404`` if the otu does not exist.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)

        resp = await client.delete(url)

        assert await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_list_sequences(error, snapshot, spawn_client, resp_is, test_otu, test_sequence):
    client = await spawn_client(authorize=True)

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    await client.db.sequences.insert_one(test_sequence)

    resp = await client.get("/api/otus/6116cba1/isolates/cab8b360/sequences")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_get_sequence(error, snapshot, spawn_client, resp_is, test_otu, test_sequence):
    client = await spawn_client(authorize=True)

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    if error != "404_sequence":
        await client.db.sequences.insert_one(test_sequence)

    resp = await client.get("/api/otus/6116cba1/isolates/cab8b360/sequences/KX269872")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200
    snapshot.assert_match(await resp.json(), "json")


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_create_sequence(error, snapshot, spawn_client, check_ref_right, resp_is, test_otu,
                               test_random_alphanumeric):
    client = await spawn_client(authorize=True, permissions=["modify_otu"])

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    await client.db.references.insert_one({
        "_id": "hxn167",
        "data_type": "genome"
    })

    data = {
        "accession": "foobar",
        "host": "Plant",
        "sequence": "ATGCGTGTACTG",
        "definition": "A made up sequence"
    }

    resp = await client.post("/api/otus/6116cba1/isolates/cab8b360/sequences", data)

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    sequence_id = test_random_alphanumeric.history[0]

    assert resp.status == 201
    assert resp.headers["Location"] == f"/api/otus/6116cba1/isolates/cab8b360/sequences/{sequence_id}"

    snapshot.assert_match(await resp.json(), "json")
    snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
    snapshot.assert_match(await client.db.sequences.find_one(sequence_id), "sequence")
    snapshot.assert_match(await client.db.history.find_one(), "history")


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_edit_sequence(error, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_sequence):
    client = await spawn_client(authorize=True, permissions=["modify_otu"])

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    if error != "404_sequence":
        await client.db.sequences.insert_one(test_sequence)

    await client.db.references.insert_one({
        "_id": "hxn167",
        "data_type": "genome"
    })

    data = {
        "host": "Grapevine",
        "sequence": "ATGCGTGTACTG",
        "definition": "A made up sequence"
    }

    resp = await client.patch("/api/otus/6116cba1/isolates/cab8b360/sequences/KX269872", data)

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")
    snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
    snapshot.assert_match(await client.db.sequences.find_one("KX269872"), "sequence")
    snapshot.assert_match(await client.db.history.find_one(), "history")


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_remove_sequence(error, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_sequence):
    client = await spawn_client(authorize=True)

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    if error != "404_sequence":
        await client.db.sequences.insert_one(test_sequence)

    resp = await client.delete("/api/otus/6116cba1/isolates/cab8b360/sequences/KX269872")

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)

    snapshot.assert_match(await client.db.otus.find_one("6116cba1"), "otu")
    snapshot.assert_match(await client.db.history.find_one(), "history")


@pytest.mark.parametrize("error", [None, "404"])
async def test_download_otu(error, spawn_client, resp_is, test_sequence, test_otu):
    client = await spawn_client(authorize=True)

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    await client.db.sequences.insert_one(test_sequence)

    resp = await client.get("/api/otus/6116cba1.fa")

    if error == "404_otu":
        assert await resp_is.not_found(resp, "OTU not found")
        return

    assert resp.status == 200
