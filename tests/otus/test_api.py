import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro
from virtool_core.models.enums import ReferencePermission

import virtool.otus.db
from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    fake2: DataFaker,
    resp_is,
    snapshot,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    test_change,
    test_otu,
    test_ref,
    test_sequence,
):
    """Test that a valid request returns a complete otu document."""
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

    if not error:
        await asyncio.gather(
            mongo.otus.insert_one({**test_otu, "user": {"id": user.id}}),
            mongo.history.insert_one({**test_change, "user": {"id": user.id}}),
            mongo.sequences.insert_one(test_sequence),
            mongo.references.insert_one(test_ref),
        )

    resp = await client.get("/otus/6116cba1")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


class TestEdit:
    @pytest.mark.parametrize(
        "data, existing_abbreviation, description",
        [
            # Name, ONLY.
            (
                {"name": "Tobacco mosaic otu"},
                "TMV",
                "Changed name to Tobacco mosaic otu",
            ),
            # Name and abbreviation, BOTH CHANGE.
            (
                {"name": "Tobacco mosaic otu", "abbreviation": "TMV"},
                "PVF",
                "Changed name to Tobacco mosaic otu and changed abbreviation to TMV",
            ),
            # Name and abbreviation, NO NAME CHANGE because old is same as new.
            (
                {"name": "Prunus virus F", "abbreviation": "TMV"},
                "PVF",
                "Changed abbreviation to TMV",
            ),
            # Name and abbreviation, NO ABBR CHANGE because old is same as new.
            (
                {"name": "Tobacco mosaic otu", "abbreviation": "TMV"},
                "TMV",
                "Changed name to Tobacco mosaic otu",
            ),
            # Name and abbreviation, ABBR REMOVED because old is "TMV" and new is "".
            (
                {"name": "Tobacco mosaic otu", "abbreviation": ""},
                "TMV",
                "Changed name to Tobacco mosaic otu and removed abbreviation TMV",
            ),
            # Name and abbreviation, ABBR ADDED because old is "" and new is "TMV".
            (
                {"name": "Tobacco mosaic otu", "abbreviation": "TMV"},
                "",
                "Changed name to Tobacco mosaic otu and added abbreviation TMV",
            ),
            # Abbreviation, ONLY.
            ({"abbreviation": "TMV"}, "PVF", "Changed abbreviation to TMV"),
            # Abbreviation, ONLY because old name is same as new.
            (
                {"name": "Prunus virus F", "abbreviation": "TMV"},
                "PVF",
                "Changed abbreviation to TMV",
            ),
            # Abbreviation, ADDED.
            ({"abbreviation": "TMV"}, "", "Added abbreviation TMV"),
            # Abbreviation, REMOVED.
            ({"abbreviation": ""}, "TMV", "Removed abbreviation TMV"),
        ],
    )
    async def test(
        self,
        data,
        existing_abbreviation,
        description,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_ref,
    ):
        """Test that changing the name and abbreviation results:

        * Changes to the otu
        * A new change document in history.

        """
        client = await spawn_client(authenticated=True)

        test_otu["abbreviation"] = existing_abbreviation

        await asyncio.gather(
            mongo.otus.insert_one(test_otu),
            mongo.references.insert_one(test_ref),
        )

        resp = await client.patch("/otus/6116cba1", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one() == snapshot
        assert await mongo.history.find_one() == snapshot

    @pytest.mark.parametrize(
        "data,message",
        [
            (
                {"name": "Tobacco mosaic virus", "abbreviation": "FBV"},
                "Name already exists",
            ),
            (
                {"name": "Foobar virus", "abbreviation": "TMV"},
                "Abbreviation already exists",
            ),
            (
                {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
                "Name and abbreviation already exist",
            ),
        ],
    )
    async def test_field_exists(
        self,
        data,
        message,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
    ):
        """Test that the request fails with ``409 Conflict`` if the requested name or abbreviation already exists."""
        client = await spawn_client(authenticated=True)

        await mongo.otus.insert_many(
            [
                {
                    "_id": "test",
                    "name": "Prunus virus F",
                    "lower_name": "prunus virus f",
                    "isolates": [],
                    "reference": {"id": "foo"},
                },
                {
                    "_id": "conflict",
                    "name": "Tobacco mosaic virus",
                    "abbreviation": "TMV",
                    "lower_name": "tobacco mosaic virus",
                    "isolates": [],
                    "reference": {"id": "foo"},
                },
            ],
            session=None,
        )

        resp = await client.patch("/otus/test", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        await resp_is.bad_request(resp, message)

    @pytest.mark.parametrize(
        "change_count,data",
        [
            (0, {"abbreviation": "PVF"}),
            (0, {"abbreviation": "PVF", "name": "Prunus virus F"}),
            (1, {"abbreviation": "PVF2"}),
            (1, {"abbreviation": "PVF", "name": "Prunus virus G"}),
        ],
    )
    async def test_no_change(
        self,
        change_count,
        data,
        fake2,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_change,
        test_otu,
        test_ref,
        test_sequence,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        test_change.update({"user": {"id": user.id}, "_id": "6116cba1.0"})

        await asyncio.gather(
            mongo.otus.insert_one(test_otu),
            mongo.references.insert_one(test_ref),
            mongo.sequences.insert_one(test_sequence),
            mongo.history.insert_one(test_change),
        )

        resp = await client.patch(f"/otus/{test_otu['_id']}", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await mongo.history.count_documents({}) == 1 + change_count
        assert await resp.json() == snapshot(name="json")

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authenticated=True)

        data = {"name": "Tobacco mosaic otu", "abbreviation": "TMV"}

        resp = await client.patch("/otus/test", data)

        await resp_is.not_found(resp)


@pytest.mark.parametrize(
    "abbreviation,exists",
    [("", True), ("PVF", True), ("", False)],
)
async def test_remove(
    abbreviation,
    exists,
    snapshot,
    mongo: Mongo,
    spawn_client,
    check_ref_right,
    resp_is,
    test_otu,
):
    """Test that an existing otu can be removed."""
    client = await spawn_client(
        authenticated=True,
        permissions=[ReferencePermission.modify_otu],
    )

    test_otu["abbreviation"] = abbreviation

    if exists:
        await mongo.otus.insert_one(test_otu)

    old = await mongo.otus.find_one("6116cba1")

    resp = await client.delete("/otus/6116cba1")

    if not exists:
        assert old is None
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)
    assert await mongo.otus.count_documents({"_id": "6116cba1"}) == 0
    assert await mongo.history.find_one() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_list_isolates(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    resp_is,
    test_otu,
):
    """Test the isolates are properly listed and formatted for an existing otu."""
    client = await spawn_client(authenticated=True)

    if not error:
        test_otu["isolates"].append(
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "id": "bcb9b352",
            },
        )

        await mongo.otus.insert_one(test_otu)

    resp = await client.get("/otus/6116cba1/isolates")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_get_isolate(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    resp_is,
    test_otu,
    test_sequence,
):
    """Test that an existing isolate is successfully returned."""
    client = await spawn_client(authenticated=True)

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    await mongo.sequences.insert_one(test_sequence)

    resp = await client.get("/otus/6116cba1/isolates/cab8b360")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


class TestAddIsolate:
    @pytest.mark.parametrize("default", [True, False])
    async def test_default(
        self,
        default,
        mocker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_random_alphanumeric,
    ):
        """Test that a new default isolate can be added, setting ``default`` to ``False``
        on all other isolates in the process.

        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post(
            "/otus/6116cba1/isolates",
            {"source_name": "b", "source_type": "isolate", "default": default},
        )

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one("6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_first(
        self,
        mocker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_random_alphanumeric,
    ):
        """Test that the first isolate for a otu is set as the ``default`` otu even if ``default`` is set to ``False``
        in the POST input.

        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[ReferencePermission.modify_otu],
        )

        test_otu["isolates"] = []

        await mongo.otus.insert_one(test_otu)

        data = {"source_name": "b", "source_type": "isolate", "default": False}

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post("/otus/6116cba1/isolates", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one("6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_force_case(
        self,
        mocker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_random_alphanumeric,
    ):
        """Test that the ``source_type`` value is forced to lower case."""
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)

        mocker.patch("virtool.references.db.check_source_type", make_mocked_coro(True))

        resp = await client.post(
            "/otus/6116cba1/isolates",
            {"source_name": "Beta", "source_type": "Isolate", "default": False},
        )

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one("6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        data = {"source_name": "Beta", "source_type": "Isolate", "default": False}

        resp = await client.post("/otus/6116cba1/isolates", data)

        await resp_is.not_found(resp)


class TestUpdateIsolate:
    @pytest.mark.parametrize(
        "data,description",
        [
            ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
            ({"source_type": "variant"}, "Renamed Isolate b to Variant b"),
            (
                {"source_type": "variant", "source_name": "A"},
                "Renamed Isolate b to Variant A",
            ),
            ({"source_name": "A"}, "Renamed Isolate b to Isolate A"),
        ],
    )
    async def test(
        self,
        data,
        description,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
    ):
        """Test that a change to the isolate name results in the correct changes, history, and response."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        test_otu["isolates"].append(
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False,
            },
        )

        await mongo.otus.insert_one(test_otu)

        await mongo.references.insert_one(
            {
                "_id": "hxn167",
                "restrict_source_types": False,
                "source_types": ["isolate"],
            },
        )

        resp = await client.patch("/otus/6116cba1/isolates/test", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one("6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_force_case(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
    ):
        """Test that the ``source_type`` value is forced to lower case."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        await asyncio.gather(
            mongo.otus.insert_one(test_otu),
            mongo.references.insert_one(
                {
                    "_id": "hxn167",
                    "restrict_source_types": False,
                    "source_types": ["isolate"],
                },
            ),
        )

        data = {
            "source_type": "Variant",
        }

        resp = await client.patch("/otus/6116cba1/isolates/cab8b360", data)

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await resp.json() == snapshot

        assert await mongo.otus.find_one("6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    @pytest.mark.parametrize(
        "otu_id,isolate_id",
        [("6116cba1", "test"), ("test", "cab8b360"), ("test", "test")],
    )
    async def test_not_found(
        self,
        otu_id,
        isolate_id,
        mongo: Mongo,
        spawn_client,
        test_otu,
        resp_is,
    ):
        """Test that a request for a non-existent otu or isolate results in a ``404`` response."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)

        data = {"source_type": "variant", "source_name": "A"}

        resp = await client.patch(f"/otus/{otu_id}/isolates/{isolate_id}", data)

        await resp_is.not_found(resp)


class TestSetAsDefault:
    async def test(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_random_alphanumeric,
        static_time,
    ):
        """Test changing the default isolate results in the correct changes, history, and response."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        test_otu["isolates"].append(
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False,
            },
        )

        await mongo.otus.insert_one(test_otu)

        resp = await client.put("/otus/6116cba1/isolates/test/default", {})

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await resp.json() == snapshot

        assert await virtool.otus.db.join(mongo, "6116cba1") == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_no_change(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        static_time,
        test_change,
        test_random_alphanumeric,
    ):
        """Test that a call resulting in no change (calling endpoint on an already default isolate) results in no change.
        Specifically no increment in version.

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        test_otu["isolates"].append(
            {
                "id": "test",
                "source_name": "b",
                "source_type": "isolate",
                "default": False,
            },
        )

        await asyncio.gather(
            mongo.otus.insert_one(test_otu),
            mongo.history.insert_one(test_change),
        )

        resp = await client.put("/otus/6116cba1/isolates/cab8b360/default", {})

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 200
        assert await resp.json() == snapshot

        assert await virtool.otus.db.join(mongo, "6116cba1") == snapshot
        assert await mongo.history.count_documents({}) == 1

    @pytest.mark.parametrize(
        "otu_id,isolate_id",
        [("6116cba1", "test"), ("test", "cab8b360"), ("test", "test")],
    )
    async def test_not_found(
        self,
        otu_id,
        isolate_id,
        mongo: Mongo,
        spawn_client,
        test_otu,
        resp_is,
    ):
        """Test that ``404 Not found`` is returned if the otu or isolate does not exist"""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)

        resp = await client.put(f"/otus/{otu_id}/isolates/{isolate_id}/default", {})

        await resp_is.not_found(resp)


class TestRemoveIsolate:
    async def test(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_sequence,
    ):
        """Test that a valid request results in a ``204`` response and the isolate and
        sequence data is removed from MongoDB.

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)
        await mongo.sequences.insert_one(test_sequence)

        assert await mongo.otus.count_documents({"isolates.id": "cab8b360"}) == 1

        resp = await client.delete("/otus/6116cba1/isolates/cab8b360")

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        await resp_is.no_content(resp)

        assert await mongo.otus.count_documents({"isolates.id": "cab8b360"}) == 0
        assert await mongo.sequences.count_documents({}) == 0
        assert await mongo.history.find_one() == snapshot

    async def test_change_default(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        check_ref_right,
        resp_is,
        test_otu,
        test_sequence,
    ):
        """Test that a valid request results in a ``204`` response and ``default`` status is reassigned correctly."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        test_otu["isolates"].append(
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "id": "bcb9b352",
            },
        )

        await mongo.otus.insert_one(test_otu)
        await mongo.sequences.insert_one(test_sequence)

        resp = await client.delete("/otus/6116cba1/isolates/cab8b360")

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        await resp_is.no_content(resp)
        assert await mongo.otus.count_documents({"isolates.id": "cab8b360"}) == 0
        assert not await mongo.sequences.count_documents({})

        assert await mongo.otus.find_one({"isolates.id": "bcb9b352"}) == snapshot
        assert await mongo.history.find_one() == snapshot

    @pytest.mark.parametrize(
        "url",
        ["/otus/foobar/isolates/cab8b360", "/otus/test/isolates/foobar"],
    )
    async def test_not_found(self, url, mongo: Mongo, spawn_client, test_otu, resp_is):
        """Test that removal fails with ``404`` if the otu does not exist."""
        client = await spawn_client(
            authenticated=True,
            permissions=[ReferencePermission.modify_otu],
        )

        await mongo.otus.insert_one(test_otu)

        resp = await client.delete(url)

        await resp_is.not_found(resp)


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_list_sequences(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    resp_is,
    test_otu,
    test_sequence,
):
    client = await spawn_client(authenticated=True)

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    await mongo.sequences.insert_one(test_sequence)

    resp = await client.get("/otus/6116cba1/isolates/cab8b360/sequences")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_get_sequence(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    resp_is,
    test_otu,
    test_ref,
    test_sequence,
):
    client = await spawn_client(authenticated=True)

    await mongo.references.insert_one({**test_ref, "_id": "ref"})

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    if error != "404_sequence":
        await mongo.sequences.insert_one(test_sequence)

    resp = await client.get(
        f"/otus/6116cba1/isolates/cab8b360/sequences/{test_sequence['_id']}",
    )

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "error,segment",
    [(None, "null"), (None, "test_segment"), ("404_otu", None), ("404_isolate", None)],
)
async def test_create_sequence(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    check_ref_right,
    resp_is,
    test_otu,
    test_random_alphanumeric,
    test_ref,
    segment,
):
    client = await spawn_client(
        authenticated=True,
        base_url="https://virtool.example.com",
        permissions=[ReferencePermission.modify_otu],
    )

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    await mongo.references.insert_one(test_ref)

    data = {
        "accession": "foobar",
        "host": "Plant",
        "sequence": "ATGCGTGTACTG",
        "definition": "A made up sequence",
    }

    if segment:
        resp = await client.patch(
            "/otus/6116cba1",
            {
                "schema": [
                    {"name": "test_segment", "molecule": "ssDNA", "required": False},
                ],
            },
        )

        if check_ref_right:
            assert resp.status == 200

        data["segment"] = segment if segment != "null" else None

    resp = await client.post("/otus/6116cba1/isolates/cab8b360/sequences", data)

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 201
    assert resp.headers["Location"] == snapshot
    assert await resp.json() == snapshot

    assert await asyncio.gather(
        mongo.sequences.find_one(),
        mongo.otus.find_one("6116cba1"),
        mongo.history.find_one({"method_name": "create_sequence"}),
    ) == snapshot(name="db")


@pytest.mark.parametrize(
    "error, segment",
    [
        (None, "null"),
        (None, "test_segment"),
        ("404_otu", None),
        ("404_isolate", None),
        ("404_sequence", None),
    ],
)
async def test_edit_sequence(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    check_ref_right,
    resp_is,
    test_otu,
    test_sequence,
    segment,
):
    client = await spawn_client(
        authenticated=True,
        permissions=[ReferencePermission.modify_otu],
    )

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    if error != "404_sequence":
        await mongo.sequences.insert_one(test_sequence)

    await mongo.references.insert_one({"_id": "hxn167", "data_type": "genome"})

    data = {
        "host": "Grapevine",
        "sequence": "ATGCGTGTACTG",
        "definition": "A made up sequence",
    }

    if segment:
        data["segment"] = segment if segment != "null" else None
        await client.patch(
            "/otus/6116cba1",
            {
                "schema": [
                    {"name": "test_segment", "molecule": "ssDNA", "required": False},
                ],
            },
        )

    resp = await client.patch(
        f"/otus/6116cba1/isolates/cab8b360/sequences/{test_sequence['_id']}",
        data,
    )

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 200
    assert await resp.json() == snapshot

    assert await mongo.otus.find_one("6116cba1") == snapshot
    assert await mongo.sequences.find_one("KX269872") == snapshot
    assert await mongo.history.find_one({"method_name": "edit_sequence"}) == snapshot


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate", "404_sequence"])
async def test_remove_sequence(
    error,
    snapshot,
    mongo: Mongo,
    spawn_client,
    check_ref_right,
    resp_is,
    test_otu,
    test_sequence,
):
    client = await spawn_client(authenticated=True)

    if error == "404_isolate":
        test_otu["isolates"] = []

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    if error != "404_sequence":
        await mongo.sequences.insert_one(test_sequence)

    resp = await client.delete(
        f"/otus/6116cba1/isolates/cab8b360/sequences/{test_sequence['_id']}",
    )

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)

    assert await mongo.otus.find_one("6116cba1") == snapshot
    assert await mongo.history.find_one() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_download_otu(
    error,
    mongo: Mongo,
    spawn_client,
    resp_is,
    test_sequence,
    test_otu,
):
    client = await spawn_client(authenticated=True)

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    await mongo.sequences.insert_one(test_sequence)

    resp = await client.get("/otus/6116cba1.fa")

    if error == "404_otu":
        await resp_is.not_found(resp, "OTU not found")
        return

    assert resp.status == 200


@pytest.mark.parametrize("error", [None, "404_otu", "404_isolate"])
async def test_download_isolate(
    error,
    resp_is,
    mongo: Mongo,
    spawn_client,
    test_otu,
    test_isolate,
    test_sequence,
):
    client = await spawn_client(authenticated=True)

    isolate = test_otu["isolates"][0]

    isolate_id = isolate["id"]

    if error == "404_isolate":
        isolate["id"] = "different"

    if error != "404_otu":
        await mongo.otus.insert_one(test_otu)

    await mongo.sequences.insert_one(test_sequence)

    resp = await client.get(f"/otus/{test_otu['_id']}/isolates/{isolate_id}.fa")

    if error is None:
        assert resp.status == 200
        return

    await resp_is.not_found(resp)
    return


@pytest.mark.parametrize("get", ["isolate", "sequence"])
@pytest.mark.parametrize("missing", [None, "otu", "isolate", "sequence"])
async def test_all(get, missing, mongo: Mongo, spawn_client):
    client = await spawn_client(authenticated=True)

    isolates = [{"id": "baz", "source_type": "isolate", "source_name": "Baz"}]

    if missing != "isolate":
        isolates.append({"id": "foo", "source_type": "isolate", "source_name": "Foo"})

    if missing != "otu":
        await mongo.otus.insert_one(
            {"_id": "foobar", "name": "Foobar virus", "isolates": isolates},
        )

    sequences = [
        {
            "_id": "test_1",
            "otu_id": "foobar",
            "isolate_id": "baz",
            "sequence": "ATAGGGACATA",
        },
    ]

    if missing != "sequence":
        sequences.append(
            {
                "_id": "test_2",
                "otu_id": "foobar",
                "isolate_id": "foo",
                "sequence": "ATAGGGACATA",
            },
        )

    await mongo.sequences.insert_many(sequences, session=None)

    url = "/otus/foobar/isolates"

    if get == "isolate":
        url += "/foo.fa"

    if get == "sequence":
        url += "/foo/sequences/test_2.fa"

    resp = await client.get(url)

    get_isolate_error = get == "isolate" and missing == "otu"
    get_sequence_error = get == "sequence" and missing in ["otu", "isolate"]

    if get == missing or get_isolate_error or get_sequence_error:
        assert resp.status == 404
    else:
        assert resp.status == 200
