from copy import deepcopy

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
async def test_get(error, spawn_client, resp_is, test_otu, test_sequence):
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

    assert await resp.json() == {
        "abbreviation": "PVF",
        "imported": True,
        "last_indexed_version": 0,
        "verified": False,
        "most_recent_change": None,
        "name": "Prunus virus F",
        "version": 0,
        "id": "6116cba1",
        "schema": [],
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
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "segment": None
                    }
                ]
            }
        ],
        "issues": None,
        "reference": {
            "id": "hxn167"
        }
    }


class TestCreate:

    @pytest.mark.parametrize("exists", [True, False])
    @pytest.mark.parametrize("abbreviation", [None, "", "TMV"])
    async def test(self, exists, abbreviation, mocker, snapshot, spawn_client, check_ref_right, resp_is, static_time, test_random_alphanumeric):
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

        snapshot.assert_match(await resp.json(), "response")
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
            assert await resp_is.bad_request(resp, message)
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
    async def test(self, data, existing_abbreviation, description, spawn_client, check_ref_right, resp_is, test_otu,
                   test_add_history):
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
            "verified": False,
            "most_recent_change": None,
            "name": "Prunus virus F",
            "version": 1,
            "schema": [],
            "issues": {
                "empty_isolate": ["cab8b360"],
                "empty_otu": False,
                "empty_sequence":False,
                "isolate_inconsistency": False
            },
            "reference": {
                "id": "hxn167"
            }
        }

        old = deepcopy(expected)

        expected.update(data)

        assert await resp.json() == expected

        expected.update({
            "lower_name": expected["name"].lower(),
            "_id": expected.pop("id")
        })

        expected.pop("most_recent_change")
        expected.pop("issues")

        for isolate in expected["isolates"]:
            isolate.pop("sequences")

        assert await client.db.otus.find_one() == expected

        old.pop("issues")

        old.update({
            "_id": old.pop("id"),
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

        assert await resp_is.bad_request(resp, message)

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
    async def test_no_change(self, old_name, old_abbreviation, data, spawn_client, check_ref_right, resp_is):
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

        assert await resp.json() == {
            "abbreviation": "TMV",
            "id": "test",
            "isolates": [],
            "most_recent_change": None,
            "name": "Tobacco mosaic otu",
            "issues": {
                "empty_isolate": False,
                "empty_otu": True,
                "empty_sequence": False,
                "isolate_inconsistency": False
            },
            "reference": {
                "id": "foo"
            }
        }

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        data = {
            "name": "Tobacco mosaic otu",
            "abbreviation": "TMV"
        }

        resp = await client.patch("/api/otus/test", data)

        assert await resp_is.not_found(resp)


@pytest.mark.parametrize("abbreviation,description,exists", [
    (
        "",
        "Removed Prunus virus F",
        True

    ),
    (
        "PVF",
        "Removed Prunus virus F (PVF)",
        True
    ),
    (
        "",
        "",
        False
    )
])
async def test_remove(abbreviation, description, exists, spawn_client, check_ref_right, resp_is, test_otu,
                      test_add_history):
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

    assert resp.status == 204

    assert await client.db.otus.find({"_id": "6116cba1"}).count() == 0

    old["isolates"][0]["sequences"] = []

    assert test_add_history.call_args[0][1:] == (
        "remove",
        old,
        None,
        description,
        "test"
    )


@pytest.mark.parametrize("error", [None, "404"])
async def test_list_isolates(error, spawn_client, resp_is, test_otu):
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


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_get_isolate(error, spawn_client, resp_is, test_otu, test_sequence):
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

    test_sequence["id"] = test_sequence.pop("_id")

    del test_sequence["otu_id"]
    del test_sequence["isolate_id"]

    assert await resp.json() == {
        "default": True,
        "source_type": "isolate",
        "source_name": "8816-v2",
        "id": "cab8b360",
        "sequences": [test_sequence]
    }


class TestAddIsolate:

    async def test_is_default(self, mocker, spawn_client, check_ref_right, resp_is, test_otu, test_add_history,
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
            "default": True
        }

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/api/otus/6116cba1/isolates", data)

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201

        isolate_id = test_random_alphanumeric.history[0]

        assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/" + isolate_id

        assert await resp.json() == {
            "id": isolate_id,
            "source_type": "isolate",
            "source_name": "b",
            "default": True,
            "sequences": []
        }

        new = await client.db.otus.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": False,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": isolate_id,
                "source_name": "b",
                "source_type": "isolate",
                "default": True
            }
        ]

        for isolate in new["isolates"]:
            isolate["sequences"] = []

        test_otu["isolates"][0]["sequences"] = []

        test_add_history.assert_called_with(
            client.db,
            "add_isolate",
            test_otu,
            new,
            "Added Isolate b as default",
            "test"
        )

    async def test_not_default(self, mocker, spawn_client, check_ref_right, resp_is, test_otu, test_add_history,
                               test_random_alphanumeric):
        """
        Test that a non-default isolate can be properly added

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

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

        isolate_id = test_random_alphanumeric.history[0]

        assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/" + isolate_id

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": isolate_id,
            "default": False,
            "sequences": []
        }

        new = await client.db.otus.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "source_type": "isolate",
                "source_name": "8816-v2",
                "default": True
            },
            {
                "id": isolate_id,
                "source_name": "b",
                "source_type": "isolate",
                "default": False
            }
        ]

        for isolate in new["isolates"]:
            isolate["sequences"] = []

        test_otu["isolates"][0]["sequences"] = []

        test_add_history.assert_called_with(
            client.db,
            "add_isolate",
            test_otu,
            new,
            "Added Isolate b",
            "test"
        )

    async def test_first(self, mocker, spawn_client, check_ref_right, resp_is, test_otu, test_add_history,
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

        isolate_id = test_random_alphanumeric.history[0]

        assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/" + isolate_id

        assert await resp.json() == {
            "source_name": "b",
            "source_type": "isolate",
            "id": isolate_id,
            "default": True,
            "sequences": []
        }

        new = await client.db.otus.find_one("6116cba1")

        assert new["isolates"] == [{
            "id": isolate_id,
            "default": True,
            "source_type": "isolate",
            "source_name": "b"
        }]

        new["isolates"][0]["sequences"] = []

        test_add_history.assert_called_with(
            client.db,
            "add_isolate",
            test_otu,
            new,
            "Added Isolate b as default",
            "test"
        )

    async def test_force_case(self, mocker, spawn_client, check_ref_right, resp_is, test_otu, test_random_alphanumeric):
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

        isolate_id = test_random_alphanumeric.history[0]

        assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/" + isolate_id

        assert await resp.json() == {
            "source_name": "Beta",
            "source_type": "isolate",
            "id": isolate_id,
            "default": False,
            "sequences": []
        }

        document = await client.db.otus.find_one("6116cba1")

        assert document["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": isolate_id,
                "source_name": "Beta",
                "source_type": "isolate",
                "default": False
            }
        ]

    async def test_empty(self, mocker, spawn_client, check_ref_right, resp_is, test_otu, test_random_alphanumeric):
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

        isolate_id = test_random_alphanumeric.history[0]

        assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/" + isolate_id

        assert await resp.json() == {
            "id": isolate_id,
            "source_name": "",
            "source_type": "",
            "default": False,
            "sequences": []
        }

        assert (await client.db.otus.find_one("6116cba1", ["isolates"]))["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            {
                "id": isolate_id,
                "source_name": "",
                "source_type": "",
                "default": False
            }
        ]

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
    async def test(self, data, description, spawn_client, check_ref_right, resp_is, test_otu, test_add_history):
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

        expected = dict(test_otu["isolates"][1])

        expected.update(data)

        assert await resp.json() == dict(expected, sequences=[])

        new = await client.db.otus.find_one("6116cba1")

        assert new["isolates"] == [
            {
                "id": "cab8b360",
                "default": True,
                "source_type": "isolate",
                "source_name": "8816-v2"
            },
            expected
        ]

        for joined in (test_otu, new):
            for isolate in joined["isolates"]:
                isolate["sequences"] = []

        assert test_add_history.call_args[0][1:] == (
            "edit_isolate",
            test_otu,
            new,
            description,
            "test"
        )

    async def test_force_case(self, spawn_client, check_ref_right, resp_is, test_otu):
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

        expected = {
            "id": "cab8b360",
            "default": True,
            "source_type": "variant",
            "source_name": "8816-v2",
            "sequences": []
        }

        assert await resp.json() == expected

        del expected["sequences"]

        assert (await client.db.otus.find_one("6116cba1", ["isolates"]))["isolates"] == [expected]

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

    async def test(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, test_random_alphanumeric, static_time):
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

        snapshot.assert_match(await resp.json(), "response")
        snapshot.assert_match(new, "joined")
        snapshot.assert_match(await client.db.history.find_one(), "history")

    async def test_no_change(self, snapshot, spawn_client, check_ref_right, resp_is, test_otu, static_time, test_random_alphanumeric):
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

        assert await client.db.history.count() == 0

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

        resp = await client.put("/api/otus/{}/isolates/{}/default".format(otu_id, isolate_id), {})

        assert await resp_is.not_found(resp)


class TestRemoveIsolate:

    async def test(self, spawn_client, check_ref_right, resp_is, test_otu, test_sequence, test_add_history):
        """
        Test that a valid request results in a ``204`` response and the isolate and sequence data is removed from the
        database.

        """
        client = await spawn_client(authorize=True, permissions=["modify_otu"])

        await client.db.otus.insert_one(test_otu)
        await client.db.sequences.insert_one(test_sequence)

        assert await client.db.otus.find({"isolates.id": "cab8b360"}).count() == 1

        resp = await client.delete("/api/otus/6116cba1/isolates/cab8b360")

        if not check_ref_right:
            assert await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 204

        assert await client.db.otus.find({"isolates.id": "cab8b360"}).count() == 0

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
                            "otu_id": "6116cba1",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None
                        }
                    ]
                }
            ],
            "schema": [],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "verified": False,
            "name": "Prunus virus F",
            "version": 0,
            "reference": {
                "id": "hxn167"
            }
        }

        new = deepcopy(old)

        new.update({
            "version": 1,
            "isolates": []
        })

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            new,
            "Removed Isolate 8816-v2",
            "test"
        )

    async def test_change_default(self, spawn_client, check_ref_right, resp_is, test_otu, test_sequence,
                                  test_add_history):
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

        assert resp.status == 204

        assert await client.db.otus.find({"isolates.id": "cab8b360"}).count() == 0

        assert (await client.db.otus.find_one({"isolates.id": "bcb9b352"}, ["isolates"]))["isolates"][0]["default"]

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
                            "otu_id": "6116cba1",
                            "isolate_id": "cab8b360",
                            "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                            "segment": None
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
            "schema": [],
            "last_indexed_version": 0,
            "lower_name": "prunus virus f",
            "verified": False,
            "name": "Prunus virus F",
            "version": 0,
            "reference": {
                "id": "hxn167"
            }
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
            "verified": False,
            "name": "Prunus virus F",
            "schema": [],
            "version": 1,
            "reference": {
                "id": "hxn167"
            }
        }

        assert test_add_history.call_args[0][1:] == (
            "remove_isolate",
            old,
            new,
            "Removed Isolate 8816-v2 and set Isolate 7865 as default",
            "test"
        )

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
async def test_list_sequences(error, spawn_client, resp_is, test_otu, test_sequence):
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

    assert await resp.json() == [{
        "id": "KX269872",
        "definition": "Prunus virus F isolate 8816-s2 segment RNA2 polyprotein 2 gene, complete cds.",
        "host": "sweet cherry",
        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
        "segment": None
    }]


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_get_sequence(error, spawn_client, resp_is, test_otu, test_sequence):
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

    test_sequence["id"] = test_sequence.pop("_id")

    assert await resp.json() == test_sequence


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_create_sequence(error, spawn_client, check_ref_right, resp_is, test_otu, test_add_history, test_random_alphanumeric):
    client = await spawn_client(authorize=True, permissions=["modify_otu"])

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

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

    assert resp.status == 201

    sequence_id = test_random_alphanumeric.history[0]

    assert resp.headers["Location"] == "/api/otus/6116cba1/isolates/cab8b360/sequences/" + sequence_id

    assert await resp.json() == {
        "id": sequence_id,
        "accession": "foobar",
        "definition": "A made up sequence",
        "otu_id": "6116cba1",
        "isolate_id": "cab8b360",
        "host": "Plant",
        "reference": {
            "id": "hxn167"
        },
        "sequence": "ATGCGTGTACTG",
        "segment": None,

    }

    old = {
        "_id": "6116cba1",
        "abbreviation": "PVF",
        "imported": True,
        "schema": [],
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
        "verified": False,
        "name": "Prunus virus F",
        "version": 0,
        "reference": {
            "id": "hxn167"
        }
    }

    new = deepcopy(old)

    new["isolates"][0]["sequences"] = [{
        "_id": test_random_alphanumeric.history[0],
        "accession": "foobar",
        "definition": "A made up sequence",
        "otu_id": "6116cba1",
        "isolate_id": "cab8b360",
        "host": "Plant",
        "reference": {
            "id": "hxn167"
        },
        "sequence": "ATGCGTGTACTG",
        "segment": None
    }]

    new.update({
        "verified": True,
        "version": 1
    })

    test_add_history.assert_called_with(
        client.db,
        "create_sequence",
        old,
        new,
        "Created new sequence foobar in Isolate 8816-v2",
        "test"
    )


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_edit_sequence(error, spawn_client, check_ref_right, resp_is, test_otu, test_sequence, test_add_history):
    client = await spawn_client(authorize=True, permissions=["modify_otu"])

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    if error != "404_sequence":
        await client.db.sequences.insert_one(test_sequence)

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

    assert await resp.json() == {
        "id": "KX269872",
        "definition": "A made up sequence",
        "host": "Grapevine",
        "otu_id": "6116cba1",
        "isolate_id": "cab8b360",
        "sequence": "ATGCGTGTACTG",
        "segment": None
    }

    old = {
        "_id": "6116cba1",
        "abbreviation": "PVF",
        "imported": True,
        "isolates": [
            {
                "default": True,
                "id": "cab8b360",
                "sequences": [dict(test_sequence, otu_id="6116cba1")],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "prunus virus f",
        "verified": False,
        "name": "Prunus virus F",
        "schema": [],
        "version": 0,
        "reference": {
            "id": "hxn167"
        }
    }

    new = deepcopy(old)

    new["isolates"][0]["sequences"] = [{
        "_id": "KX269872",
        "definition": "A made up sequence",
        "otu_id": "6116cba1",
        "isolate_id": "cab8b360",
        "host": "Grapevine",
        "sequence": "ATGCGTGTACTG",
        "segment": None
    }]

    new.update({
        "verified": True,
        "version": 1
    })

    assert test_add_history.call_args[0][1:] == (
        "edit_sequence",
        old,
        new,
        "Edited sequence KX269872 in Isolate 8816-v2",
        "test"
    )


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_remove_sequence(error, spawn_client, check_ref_right, resp_is, test_otu, test_sequence, test_add_history):
    client = await spawn_client(authorize=True)

    if error == "404_isolate":
        test_otu["isolates"] = list()

    if error != "404_otu":
        await client.db.otus.insert_one(test_otu)

    if error != "404_sequence":
        await client.db.sequences.insert_one(test_sequence)

    old = await virtool.otus.db.join(client.db, test_otu["_id"])

    resp = await client.delete("/api/otus/6116cba1/isolates/cab8b360/sequences/KX269872")

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    new = await virtool.otus.db.join(client.db, test_otu["_id"])

    assert resp.status == 204

    assert test_add_history.call_args[0][1:] == (
        "remove_sequence",
        old,
        new,
        "Removed sequence KX269872 from Isolate 8816-v2",
        "test"
    )
