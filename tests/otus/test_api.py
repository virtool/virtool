import asyncio
from http import HTTPStatus

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion
from yarl import URL

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from virtool.workflow.pytest_plugin.utils import StaticTime
from tests.fixtures.response import RespIs
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.models.enums import HistoryMethod, Molecule
from virtool.mongo.core import Mongo
from virtool.otus.models import OTU, OTUIsolate, OTUSegment, OTUSequence
from virtool.otus.oas import CreateOTURequest


class TestGet:
    async def test_ok(
        self,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        """Test that a valid request returns the expected history item."""
        client = await spawn_client(authenticated=True)

        await asyncio.gather(
            fake.users.create(),
            mongo.references.insert_one({**test_ref}),
        )

        otu = await fake.otus.create(test_ref["_id"], client.user)

        resp = await client.get(f"/otus/{otu.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(self, spawn_client, resp_is):
        """Test that a request for a non-existent change document results in a ``404``."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/history/foobar")

        await resp_is.not_found(resp)


class TestEdit:
    @pytest.mark.parametrize(
        ("data", "existing_abbreviation", "description"),
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
            # Abbreviation, ADDED.
            ({"abbreviation": "TMV"}, "", "Added abbreviation TMV"),
            # Abbreviation, REMOVED.
            ({"abbreviation": ""}, "TMV", "Removed abbreviation TMV"),
        ],
    )
    async def test(
        self,
        data,
        data_layer: DataLayer,
        existing_abbreviation: str,
        description: str,
        check_ref_right,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
        test_otu,
        test_ref,
    ):
        """Test that changing the name and abbreviation results:

        * Changes to the otu
        * A new change document in history.

        """
        client = await spawn_client(authenticated=True)

        await asyncio.gather(
            mongo.otus.insert_one(
                {**test_otu, "existing_abbreviation": existing_abbreviation},
            ),
            mongo.references.insert_one(test_ref),
        )

        resp = await client.patch("/otus/6116cba1", data)

        if check_ref_right:
            assert resp.status == HTTPStatus.OK
            assert await resp.json() == snapshot(name="json")
            assert await data_layer.otus.get("6116cba1") == snapshot(name="otu")
            assert await data_layer.history.get("6116cba1.1") == snapshot(
                name="history",
            )
        else:
            await resp_is.insufficient_rights(resp)

    @pytest.mark.parametrize(
        ("data", "message"),
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
        message: str,
        check_ref_right,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that the request fails with ``409 Conflict`` if the requested name or
        abbreviation already exists.
        """
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
        change_count: int,
        data: dict,
        check_ref_right,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        test_change,
        test_otu,
        test_ref,
        test_sequence,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await asyncio.gather(
            mongo.otus.insert_one(test_otu),
            mongo.references.insert_one(test_ref),
            mongo.sequences.insert_one(test_sequence),
            mongo.history.insert_one(
                {**test_change, "user": {"id": user.id}, "_id": "6116cba1.0"},
            ),
        )

        resp = await client.patch(f"/otus/{test_otu['_id']}", data)

        if check_ref_right:
            assert resp.status == HTTPStatus.OK
            assert await mongo.history.count_documents({}) == 1 + change_count
            assert await resp.json() == snapshot(name="json")
        else:
            await resp_is.insufficient_rights(resp)

    async def test_not_found(self, spawn_client: ClientSpawner, resp_is: RespIs):
        """Test that a request for a non-existent otu results in a ``404`` response."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch(
            "/otus/test",
            {"name": "Tobacco mosaic otu", "abbreviation": "TMV"},
        )

        await resp_is.not_found(resp)


class TestDelete:
    async def test_ok(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
        test_change,
        test_otu,
        test_ref,
        test_sequence,
    ):
        """Test that an OTU can be deleted.

        And:

        * The corresponding history is created.
        * The OTU is removed from the database.
        * The request fails if the user does not have the required permissions.
        """
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        otu = await fake.otus.create(test_ref["_id"], user)

        resp = await client.delete(f"/otus/{otu.id}")

        if check_ref_right:
            await resp_is.no_content(resp)

            with pytest.raises(ResourceNotFoundError):
                await data_layer.otus.get(otu.id)

            assert await data_layer.history.get(f"{otu.id}.removed") == snapshot(
                name="history",
            )

        else:
            await resp_is.insufficient_rights(resp)

    async def test_not_found(self, spawn_client: ClientSpawner, resp_is: RespIs):
        """Test that a request for a non-existent otu results in a ``404`` response."""
        client = await spawn_client(authenticated=True)

        resp = await client.delete("/otus/test")

        await resp_is.not_found(resp)


class TestListIsolates:
    async def test_ok(
        self,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        test_otu: dict,
    ):
        """Test the isolates can be listed for an OTU."""
        client = await spawn_client(authenticated=True)

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

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="json")

    async def test_not_found(
        self,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that a `404` is returned if the otu does not exist."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/otus/6116cba1/isolates")

        await resp_is.not_found(resp)


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

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestAddIsolate:
    @pytest.mark.parametrize("default", [True, False])
    async def test_default(
        self,
        data_layer: DataLayer,
        default: bool,
        check_ref_right,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
        test_change: dict,
        test_otu: dict,
        test_ref: dict,
        test_sequence: dict,
    ):
        """Test that a new default isolate can be added, setting ``default`` to ``False``
        on all other isolates in the process.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        otu = await data_layer.otus.create(
            "hxn167",
            CreateOTURequest(
                abbreviation="PVF",
                name="Prunus virus F",
                schema=[
                    OTUSegment(
                        molecule=Molecule.ss_rna,
                        name="Genome",
                        required=True,
                    ),
                ],
            ),
            user.id,
        )

        await data_layer.otus.add_isolate(
            otu.id,
            "b",
            "isolate",
            user.id,
            default=True,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "a", "source_type": "isolate", "default": default},
        )

        if not check_ref_right:
            await resp_is.insufficient_rights(resp)
            return

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="json")

        assert await data_layer.otus.get(otu.id) == snapshot(name="otu")

        assert [
            await data_layer.history.get(f"{otu.id}.{version}") for version in (0, 1, 2)
        ] == snapshot(name="history")

    async def test_first(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        """Test that the first isolate for an OTu is set as the ``default`` otu even if
        ``default`` is set to ``False`` in the POST input.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        otu = await data_layer.otus.create(
            "hxn167",
            CreateOTURequest(
                abbreviation="PVF",
                name="Prunus virus F",
                schema=[
                    OTUSegment(
                        molecule=Molecule.ss_rna,
                        name="Genome",
                        required=True,
                    ),
                ],
            ),
            user.id,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "b", "source_type": "isolate", "default": False},
        )

        if check_ref_right:
            assert resp.status == 201
            assert resp.headers["Location"] == snapshot(name="location")
            assert await resp.json() == snapshot(name="json")

            otu = await data_layer.otus.get(otu.id)

            assert otu == snapshot(name="otu")
            assert otu.isolates[0].default is True
            assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
                name="history",
            )

        else:
            await resp_is.insufficient_rights(resp)

    async def test_force_case(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        resp_is: RespIs,
        test_ref: dict,
    ):
        """Test that the ``source_type`` value is forced to lower case."""
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
        )

        await mongo.references.insert_one(test_ref)

        user = await fake.users.create()

        otu = await data_layer.otus.create(
            "hxn167",
            CreateOTURequest(
                abbreviation="PVF",
                name="Prunus virus F",
                schema=[
                    OTUSegment(
                        molecule=Molecule.ss_rna,
                        name="Genome",
                        required=True,
                    ),
                ],
            ),
            user.id,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "Beta", "source_type": "Isolate", "default": False},
        )

        if check_ref_right:
            assert resp.status == 201
            assert resp.headers["Location"] == snapshot(name="location")
            assert await resp.json() == snapshot(name="json")

            otu = await data_layer.otus.get(otu.id)
            assert otu.isolates[0].source_type == "isolate"
            assert otu == snapshot(name="otu")
            assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
                name="history",
            )

        else:
            await resp_is.insufficient_rights(resp)

    async def test_not_found(self, spawn_client: ClientSpawner, resp_is: RespIs):
        client = await spawn_client(authenticated=True)

        resp = await client.post(
            "/otus/6116cba1/isolates",
            {"source_name": "Beta", "source_type": "Isolate", "default": False},
        )

        await resp_is.not_found(resp)


class TestUpdateIsolate:
    client: VirtoolTestClient
    isolate: OTUIsolate
    otu: OTU

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        self.client = await spawn_client(authenticated=True)

        await mongo.references.insert_one(
            {
                **test_ref,
                "users": [
                    {
                        "id": self.client.user.id,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        )

        self.otu = await fake.otus.create("hxn167", self.client.user)
        self.isolate = self.otu.isolates[0]

    @pytest.mark.parametrize(
        "data",
        [
            {"source_type": "variant"},
            {"source_type": "variant", "source_name": "A"},
            {"source_name": "A"},
        ],
        ids=["source_type", "both", "source_name"],
    )
    async def test_ok(
        self,
        data: dict,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        """Test that a change to the isolate name results in the correct changes,
        history, and response.
        """
        resp = await self.client.patch(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}",
            data,
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="json")

        otu = await data_layer.otus.get(self.otu.id)

        assert otu.isolates[0].source_name == data.get(
            "source_name",
            self.otu.isolates[0].source_name,
        )

        assert otu.isolates[0].source_type == data.get(
            "source_type",
            self.otu.isolates[0].source_type,
        )

        assert otu.version - self.otu.version == 1

        assert otu == snapshot(name="otu")

        assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
            name="history",
        )

    async def test_force_case(self, data_layer: DataLayer, snapshot: SnapshotAssertion):
        """Test that the ``source_type`` value is forced to lower case."""
        resp = await self.client.patch(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}",
            {
                "source_type": "Variant",
            },
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["source_type"] == "variant"
        assert body == snapshot

        otu = await data_layer.otus.get(self.otu.id)

        assert otu.isolates[0].source_type == "variant"
        assert otu.version - self.otu.version == 1

    @pytest.mark.parametrize("otu_exists", [True, False])
    @pytest.mark.parametrize("isolate_exists", [True, False])
    async def test_not_found(
        self,
        otu_exists: bool,
        isolate_exists: bool,
        resp_is: RespIs,
    ):
        """Test that a request for a non-existent otu or isolate results in a ``404``
        response.
        """
        otu_id = self.otu.id if otu_exists else "test"
        isolate_id = self.isolate.id if isolate_exists else "test"

        resp = await self.client.patch(
            f"/otus/{otu_id}/isolates/{isolate_id}",
            {"source_type": "variant", "source_name": "A"},
        )

        if not (otu_exists and isolate_exists):
            await resp_is.not_found(resp)


class TestSetAsDefault:
    client: VirtoolTestClient
    isolate: OTUIsolate
    otu: OTU

    @pytest.fixture(autouse=True)
    async def _setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        self.client = await spawn_client(authenticated=True)

        await mongo.references.insert_one(
            {
                **test_ref,
                "users": [
                    {
                        "id": self.client.user.id,
                        "build": True,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        )

        self.otu = await fake.otus.create("hxn167", self.client.user)
        self.isolate = self.otu.isolates[0]

    async def test(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        """Test changing the default isolate results in the correct changes, history,
        and response.
        """
        new_isolate = await data_layer.otus.add_isolate(
            self.otu.id,
            "isolate",
            "b",
            self.client.user.id,
        )

        resp = await self.client.put(
            f"/otus/{self.otu.id}/isolates/{new_isolate.id}/default",
            {},
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["default"] is True
        assert body == snapshot(name="json")

        otu = await data_layer.otus.get(self.otu.id)

        assert [
            isolate.default == (isolate.id == new_isolate.id)
            for isolate in otu.isolates
        ]

        assert otu.version == self.otu.version + 2

        history = await data_layer.history.get(otu.most_recent_change.id)

        assert history.description == "Set Isolate b as default"
        assert history.method_name == HistoryMethod.set_as_default

        assert history == snapshot(name="history")

    async def test_no_change(self, data_layer: DataLayer, snapshot: SnapshotAssertion):
        """Test that setting the default isolate is idempotent.

        No new history should be generated and the OTU version should not change.
        """
        resp = await self.client.put(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}/default",
            {},
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="json")

        assert await data_layer.otus.get(self.otu.id) == self.otu

    @pytest.mark.parametrize("resource", ["otu", "isolate", "both"])
    async def test_not_found(self, resource: str, resp_is: RespIs):
        """Test that ``404 Not found`` is returned if the otu or isolate does not
        exist.
        """
        otu_id = "test" if resource in ("otu", "both") else self.otu.id
        isolate_id = "test" if resource in ("isolate", "both") else self.isolate.id

        resp = await self.client.put(
            f"/otus/{otu_id}/isolates/{isolate_id}/default",
            {},
        )

        await resp_is.not_found(resp)


class TestDeleteIsolate:
    async def test_ok(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        """Test that a valid request results in a ``204`` response and the isolate and
        associated sequence data is removed.
        """
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        otu = await fake.otus.create("hxn167", user)

        isolate = otu.isolates[0]

        sequence = await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "OR596737.1",
            "Prunus virus F isolate PCEG segment RNA2",
            "TAAGAGATTAAACAACCGCTTTCGTTACCAGAAACTGCTTTCTTTGAACGTTTCTGTTTGCTT",
            user.id,
            "Prunus cerasus",
            user.id,
        )

        assert (await data_layer.otus.get(otu.id)).isolates[0].id == isolate.id

        resp = await client.delete(f"/otus/{otu.id}/isolates/{isolate.id}")

        if check_ref_right:
            await resp_is.no_content(resp)

            otu = await data_layer.otus.get(otu.id)

            assert otu.isolates == []

            with pytest.raises(ResourceNotFoundError):
                await data_layer.otus.get_isolate_fasta(otu.id, isolate.id)

            with pytest.raises(ResourceNotFoundError):
                await data_layer.otus.get_sequence(otu.id, isolate.id, sequence.id)

            assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
                name="history",
            )

        else:
            await resp_is.insufficient_rights(resp)

    async def test_default(
        self,
        check_ref_right,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
        test_ref: dict,
    ):
        """Test that a valid request results in a ``204`` response and ``default``
        status is reassigned correctly.
        """
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        otu = await fake.otus.create("hxn167", user)

        first_isolate = otu.isolates[0]

        await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "b",
            user.id,
        )

        otu = await data_layer.otus.get(otu.id)

        assert otu.isolates[0].default is True
        assert otu.isolates[0].source_name == first_isolate.source_name
        assert otu.isolates[1].default is False
        assert otu.isolates[1].source_name == "b"

        resp = await client.delete(f"/otus/{otu.id}/isolates/{first_isolate.id}")

        if check_ref_right:
            await resp_is.no_content(resp)

            otu = await data_layer.otus.get(otu.id)

            assert otu == snapshot(name="otu")

            assert otu.isolates[0].default is True
            assert otu.isolates[0].source_name == "b"

            assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
                name="history",
            )

        else:
            await resp_is.insufficient_rights(resp)

    @pytest.mark.parametrize(
        "url",
        ["/otus/foobar/isolates/cab8b360", "/otus/test/isolates/foobar"],
        ids=["otu_not_found", "isolate_not_found"],
    )
    async def test_not_found(
        self,
        url: str,
        mongo: Mongo,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
        test_otu: dict,
    ):
        """Test that removal fails with ``404`` if the otu does not exist."""
        client = await spawn_client(authenticated=True)

        await mongo.otus.insert_one(test_otu)

        resp = await client.delete(url)

        await resp_is.not_found(resp)


class TestListSequences:
    async def test_ok(
        self,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        test_ref,
    ):
        """Test that sequences can be listed for an isolate."""
        client = await spawn_client(authenticated=True)

        await mongo.references.insert_one(test_ref)

        user = await fake.users.create()

        otu = await fake.otus.create(test_ref["_id"], user)

        resp = await client.get(
            f"/otus/{otu.id}/isolates/{otu.isolates[0].id}/sequences",
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(
        self,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that a `404` is returned if the otu or isolate does not exist."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/otus/6116cba1/isolates/cab8b360/sequences")

        await resp_is.not_found(resp)


class TestGetSequence:
    async def test_ok(
        self,
        fake: DataFaker,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        test_ref: dict,
    ):
        client = await spawn_client(authenticated=True)

        await mongo.references.insert_one(test_ref)

        user = await fake.users.create()

        otu = await fake.otus.create(test_ref["_id"], user)
        isolate = otu.isolates[0]
        sequence = isolate.sequences[0]

        resp = await client.get(
            f"/otus/{otu.id}/isolates/{isolate.id}/sequences/{sequence.id}",
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot


class TestCreateSequence:
    isolate: OTUIsolate
    otu: OTU

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        fake: DataFaker,
        mongo: Mongo,
        static_time: StaticTime,
        test_ref: dict,
    ):
        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        self.otu = await fake.otus.create(test_ref["_id"], user)
        self.isolate = self.otu.isolates[0]

    async def test_ok(
        self,
        check_ref_right,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a sequence and associated history can be created."""
        client = await spawn_client(authenticated=True)

        resp = await client.post(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}/sequences",
            {
                "accession": "foobar",
                "host": "Plant",
                "sequence": "ATGCGTGTACTG",
                "definition": "A made up sequence",
            },
        )

        if check_ref_right:
            assert resp.status == 201
            assert resp.headers["Location"] == snapshot(name="location")
            assert await resp.json() == snapshot(name="json")

            otu = await data_layer.otus.get(self.otu.id)

            assert otu == snapshot(name="otu")

            assert await data_layer.otus.get_sequence(
                self.otu.id,
                self.isolate.id,
                (await resp.json())["id"],
            ) == snapshot(name="sequence")

            assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
                name="history",
            )

    @pytest.mark.parametrize("resource", ["both", "isolate", "otu"])
    async def test_not_found(
        self,
        resource: str,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that a request for a non-existent otu or isolate results in a ``404``
        response.
        """
        client = await spawn_client(authenticated=True)

        isolate_id = "cab8b360" if resource in ("both", "isolate") else self.isolate.id
        otu_id = "6116cba1" if resource in ("both", "otu") else self.otu.id

        resp = await client.post(
            f"/otus/{otu_id}/isolates/{isolate_id}/sequences",
            {
                "accession": "foobar",
                "host": "Plant",
                "sequence": "ATGCGTGTACTG",
                "definition": "A made up sequence",
            },
        )

        await resp_is.not_found(resp)


class TestUpdateSequence:
    client: VirtoolTestClient
    isolate: OTUIsolate
    otu: OTU
    sequence: OTUSequence

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        spawn_client: ClientSpawner,
        fake: DataFaker,
        mongo: Mongo,
        static_time: StaticTime,
        test_ref: dict,
    ):
        self.client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.references.insert_one(test_ref)

        self.otu = await fake.otus.create(test_ref["_id"], user)
        self.isolate = self.otu.isolates[0]
        self.sequence = self.isolate.sequences[0]

    async def test_ok(
        self,
        check_ref_right,
        data_layer: DataLayer,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
    ):
        """Test that a sequence can be edited.

        And:

        * The associated history is created.
        * The request fails if the user does not have the required permissions.
        """
        url = (
            URL("/otus")
            / self.otu.id
            / "isolates"
            / self.isolate.id
            / "sequences"
            / self.sequence.id
        )

        resp = await self.client.patch(
            str(url),
            {
                "definition": "A made up sequence",
                "host": "Grapevine",
                "sequence": "ATGCGTGTACTG",
            },
        )

        if check_ref_right:
            assert resp.status == HTTPStatus.OK
            assert await resp.json() == snapshot(name="json")

            otu = await data_layer.otus.get(self.otu.id)

            assert otu.version - self.otu.version == 1

            sequence = await data_layer.otus.get_sequence(
                self.otu.id,
                self.isolate.id,
                self.sequence.id,
            )

            assert sequence == snapshot(name="sequence")

            history = await data_layer.history.get(otu.most_recent_change.id)

            isolate_name = (
                f"{self.isolate.source_type.capitalize()} {self.isolate.source_name}"
            )

            assert history.method_name == HistoryMethod.edit_sequence
            assert (
                history.description
                == f"Edited sequence {sequence.id} in {isolate_name}"
            )
            assert history == snapshot(name="history")

        else:
            await resp_is.insufficient_rights(resp)

    async def test_bad_segment(
        self,
        check_ref_right,
        resp_is: RespIs,
    ):
        """Test that a request that sets a non-existent segment name
        results in a ``400`` response.
        """
        url = (
            URL("/otus")
            / self.otu.id
            / "isolates"
            / self.isolate.id
            / "sequences"
            / self.sequence.id
        )

        resp = await self.client.patch(
            str(url),
            {
                "segment": "does_not_exist",
            },
        )

        if check_ref_right:
            assert resp.status == 400
            await resp_is.bad_request(
                resp,
                "Segment does_not_exist is not defined for the parent OTU",
            )

    async def test_unset_segment(
        self,
        check_ref_right,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        """Test that a request that sets a null segment name succeeds."""
        resp = await self.client.patch(
            str(
                URL("/otus")
                / self.otu.id
                / "isolates"
                / self.isolate.id
                / "sequences"
                / self.sequence.id,
            ),
            {
                "segment": None,
            },
        )

        if check_ref_right:
            assert await resp.json() == snapshot(name="json")

            sequence = await data_layer.otus.get_sequence(
                self.otu.id,
                self.isolate.id,
                self.sequence.id,
            )

            assert sequence.segment is None

    async def test_not_found(self, resp_is: RespIs):
        """Test that a request for a non-existent otu, isolate, or sequence results in a
        ``404`` response.
        """
        resp = await self.client.patch(
            "/otus/test/isolates/test/sequences/test",
            {
                "segment": "does_not_exist",
            },
        )

        await resp_is.not_found(resp)


class TestDeleteSequence:
    client: VirtoolTestClient
    isolate: OTUIsolate
    otu: OTU
    sequence: OTUSequence

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        spawn_client: ClientSpawner,
        fake: DataFaker,
        mongo: Mongo,
        static_time: StaticTime,
        test_ref: dict,
    ):
        self.client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await mongo.references.insert_one(
            {
                **test_ref,
                "users": [
                    {
                        "id": self.client.user.id,
                        "build": True,
                        "modify": True,
                        "remove": True,
                        "modify_otu": True,
                        "remove_otu": True,
                    },
                ],
            },
        )

        self.otu = await fake.otus.create(test_ref["_id"], user)
        self.isolate = self.otu.isolates[0]
        self.sequence = self.isolate.sequences[0]

    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        url = (
            URL("/otus")
            / self.otu.id
            / "isolates"
            / self.isolate.id
            / "sequences"
            / self.sequence.id
        )

        resp = await self.client.delete(str(url))

        assert resp.status == 204
        assert await resp.json() is None
        assert await resp.text() == ""

        with pytest.raises(ResourceNotFoundError):
            await data_layer.otus.get_sequence(
                self.otu.id,
                self.isolate.id,
                self.sequence.id,
            )

        history = await data_layer.history.get(
            (await data_layer.otus.get(self.otu.id)).most_recent_change.id,
        )

        isolate_name = (
            f"{self.isolate.source_type.capitalize()} {self.isolate.source_name}"
        )

        assert history.method_name == HistoryMethod.remove_sequence
        assert (
            history.description
            == f"Removed sequence {self.sequence.id} from {isolate_name}"
        )
        assert history == snapshot(name="history")

    @pytest.mark.parametrize("otu_exists", [True, False])
    @pytest.mark.parametrize("isolate_exists", [True, False])
    @pytest.mark.parametrize("sequence_exists", [True, False])
    async def test_not_found(
        self,
        otu_exists: bool,
        isolate_exists: bool,
        sequence_exists: bool,
        resp_is: RespIs,
    ):
        """Test that a request for a non-existent otu, isolate, or sequence results in a
        ``404`` response.
        """
        url = (
            URL("/otus")
            / ("test" if not otu_exists else self.otu.id)
            / "isolates"
            / ("test" if not isolate_exists else self.isolate.id)
            / "sequences"
            / ("test" if not sequence_exists else self.sequence.id)
        )

        resp = await self.client.delete(str(url))

        if not (otu_exists and isolate_exists and sequence_exists):
            await resp_is.not_found(resp)
        else:
            assert resp.status == 204


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

    assert resp.status == HTTPStatus.OK


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
        assert resp.status == HTTPStatus.OK
        return

    await resp_is.not_found(resp)
    return
