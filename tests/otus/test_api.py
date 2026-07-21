from http import HTTPStatus

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from yarl import URL

from tests.fixtures.client import ClientSpawner, VirtoolTestClient
from tests.fixtures.references import add_reference_user, create_reference
from tests.fixtures.response import RespIs
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.models.enums import HistoryMethod, Molecule, Permission
from virtool.otus.models import OTU, OTUIsolate, OTUSegment, OTUSequence
from virtool.otus.oas import CreateOTURequest
from virtool.workflow.pytest_plugin.utils import StaticTime


class TestGet:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that a valid request returns the expected history item."""
        client = await spawn_client(authenticated=True)

        user = await data_layer.users.get(client.user.id)

        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user=user)

        response = await client.get(f"/otus/{otu.id}")

        assert response.status == HTTPStatus.OK
        assert await response.json() == snapshot_recent

    async def test_not_found(self, spawn_client, resp_is):
        """Test that a request for a non-existent change document results in a ``404``."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/history/foobar")

        await resp_is.not_found(resp)


class TestListHistory:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that an OTU's history is listed from Postgres."""
        client = await spawn_client(authenticated=True)

        user = await data_layer.users.get(client.user.id)

        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user=user)

        resp = await client.get(f"/otus/{otu.id}/history")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot_recent

    async def test_not_found(self, spawn_client: ClientSpawner, resp_is: RespIs):
        """Test that listing history for a non-existent OTU results in a ``404``."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/otus/foobar/history")

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
    async def test_ok(
        self,
        data,
        data_layer: DataLayer,
        existing_abbreviation: str,
        description: str,
        insert_otu,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        test_otu,
    ):
        """Test that changing the name and abbreviation results:

        * Changes to the otu
        * A new change document in history.

        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        await insert_otu(
            {**test_otu, "existing_abbreviation": existing_abbreviation},
            reference["id"],
        )

        resp = await client.patch("/otus/6116cba1", data)

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(name="json")
        assert await data_layer.otus.get("6116cba1") == snapshot(name="otu")
        assert await data_layer.history.get("6116cba1.1") == snapshot(
            name="history",
        )

    async def test_insufficient_rights(
        self,
        insert_otu,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
        test_otu,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot edit an
        OTU.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner)

        await insert_otu(test_otu, reference["id"])

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.patch(
            "/otus/6116cba1",
            {"name": "Tobacco mosaic otu", "abbreviation": "TMV"},
        )

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
        insert_otu,
        test_otu,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that the request fails with ``400 Bad Request`` if the requested name or
        abbreviation already exists.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        await insert_otu(
            {
                **test_otu,
                "_id": "edited",
                "name": "Prunus virus F",
                "abbreviation": "",
                "lower_name": "prunus virus f",
                "isolates": [],
            },
            reference["id"],
        )

        await insert_otu(
            {
                **test_otu,
                "_id": "conflict",
                "name": "Tobacco mosaic virus",
                "abbreviation": "TMV",
                "lower_name": "tobacco mosaic virus",
                "isolates": [],
            },
            reference["id"],
        )

        resp = await client.patch("/otus/edited", data)

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
        data_layer: DataLayer,
        pg: AsyncEngine,
        spawn_client: ClientSpawner,
        snapshot: SnapshotAssertion,
        static_time: StaticTime,
    ):
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await data_layer.otus.create(
            reference["id"],
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            client.user.id,
        )

        resp = await client.patch(f"/otus/{otu.id}", data)

        assert resp.status == HTTPStatus.OK

        async with AsyncSession(pg) as session:
            history_count = await session.scalar(
                select(func.count()).select_from(SQLLegacyHistory),
            )

        assert history_count == 1 + change_count
        assert await resp.json() == snapshot(name="json")

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
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
        static_time: StaticTime,
    ):
        """Test that an OTU can be deleted.

        And:

        * The corresponding history is created.
        * The OTU is removed from the database.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await fake.otus.create(reference["id"], client.user)

        resp = await client.delete(f"/otus/{otu.id}")

        await resp_is.no_content(resp)

        with pytest.raises(ResourceNotFoundError):
            await data_layer.otus.get(otu.id)

        assert await data_layer.history.get(f"{otu.id}.removed") == snapshot(
            name="history",
        )

    async def test_insufficient_rights(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        resp_is: RespIs,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot delete an
        OTU.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner)

        otu = await fake.otus.create(reference["id"], owner.user)

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.delete(f"/otus/{otu.id}")

        await resp_is.insufficient_rights(resp)

        assert await data_layer.otus.get(otu.id) is not None

    async def test_not_found(self, spawn_client: ClientSpawner, resp_is: RespIs):
        """Test that a request for a non-existent otu results in a ``404`` response."""
        client = await spawn_client(authenticated=True)

        resp = await client.delete("/otus/test")

        await resp_is.not_found(resp)


class TestListIsolates:
    async def test_ok(
        self,
        fake: DataFaker,
        insert_otu,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        test_otu: dict,
    ):
        """Test the isolates can be listed for an OTU."""
        client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=client.user)

        test_otu["isolates"].append(
            {
                "default": False,
                "source_type": "isolate",
                "source_name": "7865",
                "id": "bcb9b352",
            },
        )

        await insert_otu(test_otu, reference.id)

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


class TestGetIsolate:
    async def test_ok(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that an existing isolate and its Postgres sequences are returned."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        isolate = await data_layer.otus.add_isolate(
            otu.id, "isolate", "8816-v2", user.id
        )

        await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "KX269872",
            "Prunus virus F segment RNA2",
            "TGTTTAAGAGATTAAACAACCGCTTTC",
            user.id,
            "sweet cherry",
        )

        resp = await client.get(f"/otus/{otu.id}/isolates/{isolate.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_otu_not_found(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a `404` is returned if the OTU does not exist."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/otus/6116cba1/isolates/cab8b360")

        await resp_is.not_found(resp)

    async def test_isolate_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a `404` is returned if the isolate does not exist."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Prunus virus F", abbreviation="PVF"),
            user.id,
        )

        resp = await client.get(f"/otus/{otu.id}/isolates/cab8b360")

        await resp_is.not_found(resp)


class TestAddIsolate:
    @pytest.mark.parametrize("default", [True, False])
    async def test_default(
        self,
        data_layer: DataLayer,
        default: bool,
        snapshot: SnapshotAssertion,
        snapshot_recent: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that a new default isolate can be added, setting ``default`` to ``False``
        on all other isolates in the process.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client, name="Example")

        otu = await data_layer.otus.create(
            reference["id"],
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
            client.user.id,
        )

        await data_layer.otus.add_isolate(
            otu.id,
            "b",
            "isolate",
            client.user.id,
            default=True,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "a", "source_type": "isolate", "default": default},
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="json")

        assert await data_layer.otus.get(otu.id) == snapshot_recent(name="otu")

        assert [
            await data_layer.history.get(f"{otu.id}.{version}") for version in (0, 1, 2)
        ] == snapshot_recent(name="history")

    async def test_insufficient_rights(
        self,
        fake: DataFaker,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot add an
        isolate.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner)

        otu = await fake.otus.create(reference["id"], owner.user)

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "a", "source_type": "isolate", "default": False},
        )

        await resp_is.insufficient_rights(resp)

    async def test_first(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that the first isolate for an OTu is set as the ``default`` otu even if
        ``default`` is set to ``False`` in the POST input.
        """
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await data_layer.otus.create(
            reference["id"],
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
            client.user.id,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "b", "source_type": "isolate", "default": False},
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="json")

        otu = await data_layer.otus.get(otu.id)

        assert otu == snapshot(name="otu")
        assert otu.isolates[0].default is True
        assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
            name="history",
        )

    async def test_force_case(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that the ``source_type`` value is forced to lower case."""
        client = await spawn_client(
            authenticated=True,
            base_url="https://virtool.example.com",
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await data_layer.otus.create(
            reference["id"],
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
            client.user.id,
        )

        resp = await client.post(
            f"/otus/{otu.id}/isolates",
            {"source_name": "Beta", "source_type": "Isolate", "default": False},
        )

        assert resp.status == 201
        assert resp.headers["Location"] == snapshot(name="location")
        assert await resp.json() == snapshot(name="json")

        otu = await data_layer.otus.get(otu.id)
        assert otu.isolates[0].source_type == "isolate"
        assert otu == snapshot(name="otu")
        assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
            name="history",
        )

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
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        self.client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=self.client.user)

        self.otu = await fake.otus.create(reference.id, self.client.user)
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
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        self.client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=self.client.user)

        self.otu = await fake.otus.create(reference.id, self.client.user)
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
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that a valid request results in a ``204`` response and the isolate and
        associated sequence data is removed.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await fake.otus.create(reference["id"], client.user)

        isolate = otu.isolates[0]

        sequence = await data_layer.otus.create_sequence(
            otu.id,
            isolate.id,
            "OR596737.1",
            "Prunus virus F isolate PCEG segment RNA2",
            "TAAGAGATTAAACAACCGCTTTCGTTACCAGAAACTGCTTTCTTTGAACGTTTCTGTTTGCTT",
            client.user.id,
            "Prunus cerasus",
        )

        assert (await data_layer.otus.get(otu.id)).isolates[0].id == isolate.id

        resp = await client.delete(f"/otus/{otu.id}/isolates/{isolate.id}")

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

    async def test_default(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        """Test that a valid request results in a ``204`` response and ``default``
        status is reassigned correctly.
        """
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await fake.otus.create(reference["id"], client.user)

        first_isolate = otu.isolates[0]

        await data_layer.otus.add_isolate(
            otu.id,
            "isolate",
            "b",
            client.user.id,
        )

        otu = await data_layer.otus.get(otu.id)

        assert otu.isolates[0].default is True
        assert otu.isolates[0].source_name == first_isolate.source_name
        assert otu.isolates[1].default is False
        assert otu.isolates[1].source_name == "b"

        resp = await client.delete(f"/otus/{otu.id}/isolates/{first_isolate.id}")

        await resp_is.no_content(resp)

        otu = await data_layer.otus.get(otu.id)

        assert otu == snapshot(name="otu")

        assert otu.isolates[0].default is True
        assert otu.isolates[0].source_name == "b"

        assert await data_layer.history.get(otu.most_recent_change.id) == snapshot(
            name="history",
        )

    async def test_insufficient_rights(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot delete an
        isolate.
        """
        owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(owner)

        otu = await fake.otus.create(reference["id"], owner.user)

        isolate = otu.isolates[0]

        client = await spawn_client(authenticated=True)

        await add_reference_user(owner, reference["id"], client.user.id)

        resp = await client.delete(f"/otus/{otu.id}/isolates/{isolate.id}")

        await resp_is.insufficient_rights(resp)

        assert (await data_layer.otus.get(otu.id)).isolates[0].id == isolate.id

    async def test_otu_not_found(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that removal fails with ``404`` if the otu does not exist."""
        client = await spawn_client(authenticated=True)

        resp = await client.delete("/otus/foobar/isolates/cab8b360")

        await resp_is.not_found(resp)

    async def test_isolate_not_found(
        self,
        fake: DataFaker,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that removal fails with ``404`` if the isolate does not exist."""
        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(client)

        otu = await fake.otus.create(reference["id"], client.user)

        resp = await client.delete(f"/otus/{otu.id}/isolates/nonexistent")

        await resp_is.not_found(resp)


class TestListSequences:
    async def test_ok(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that sequences can be listed for an isolate."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user)

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
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        otu = await fake.otus.create(reference.id, user)
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
    owner: VirtoolTestClient
    reference_id: int

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        fake: DataFaker,
        spawn_client: ClientSpawner,
        static_time: StaticTime,
    ):
        self.owner = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(self.owner)

        self.reference_id = reference["id"]

        self.otu = await fake.otus.create(self.reference_id, self.owner.user)
        self.isolate = self.otu.isolates[0]

    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        """Test that a sequence and associated history can be created."""
        resp = await self.owner.post(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}/sequences",
            {
                "accession": "foobar",
                "host": "Plant",
                "sequence": "ATGCGTGTACTG",
                "definition": "A made up sequence",
            },
        )

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

    async def test_insufficient_rights(
        self,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot create a
        sequence.
        """
        client = await spawn_client(authenticated=True)

        await add_reference_user(self.owner, self.reference_id, client.user.id)

        resp = await client.post(
            f"/otus/{self.otu.id}/isolates/{self.isolate.id}/sequences",
            {
                "accession": "foobar",
                "host": "Plant",
                "sequence": "ATGCGTGTACTG",
                "definition": "A made up sequence",
            },
        )

        await resp_is.insufficient_rights(resp)

    @pytest.mark.parametrize("resource", ["both", "isolate", "otu"])
    async def test_not_found(
        self,
        resource: str,
        resp_is: RespIs,
    ):
        """Test that a request for a non-existent otu or isolate results in a ``404``
        response.
        """
        isolate_id = "cab8b360" if resource in ("both", "isolate") else self.isolate.id
        otu_id = "6116cba1" if resource in ("both", "otu") else self.otu.id

        resp = await self.owner.post(
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
    reference_id: int
    sequence: OTUSequence

    @pytest.fixture(autouse=True)
    async def setup(
        self,
        spawn_client: ClientSpawner,
        fake: DataFaker,
        static_time: StaticTime,
    ):
        self.client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_ref],
        )

        reference = await create_reference(self.client)

        self.reference_id = reference["id"]

        self.otu = await fake.otus.create(self.reference_id, self.client.user)
        self.isolate = self.otu.isolates[0]
        self.sequence = self.isolate.sequences[0]

    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot: SnapshotAssertion,
    ):
        """Test that a sequence can be edited.

        And:

        * The associated history is created.
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
        assert history.description == f"Edited sequence {sequence.id} in {isolate_name}"
        assert history == snapshot(name="history")

    async def test_insufficient_rights(
        self,
        data_layer: DataLayer,
        resp_is: RespIs,
        spawn_client: ClientSpawner,
    ):
        """Test that a reference member without the ``modify_otu`` right cannot edit a
        sequence.
        """
        client = await spawn_client(authenticated=True)

        await add_reference_user(self.client, self.reference_id, client.user.id)

        resp = await client.patch(
            str(
                URL("/otus")
                / self.otu.id
                / "isolates"
                / self.isolate.id
                / "sequences"
                / self.sequence.id,
            ),
            {
                "definition": "A made up sequence",
                "host": "Grapevine",
                "sequence": "ATGCGTGTACTG",
            },
        )

        await resp_is.insufficient_rights(resp)

        assert (await data_layer.otus.get(self.otu.id)).version == self.otu.version

    async def test_bad_segment(
        self,
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

        await resp_is.bad_request(
            resp,
            "Segment does_not_exist is not defined for the parent OTU",
        )

    async def test_unset_segment(
        self,
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
        static_time: StaticTime,
    ):
        self.client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        reference = await fake.references.create(user=self.client.user)

        self.otu = await fake.otus.create(reference.id, user)
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


class TestDownloadOTU:
    async def test_ok(
        self,
        fake: DataFaker,
        insert_otu,
        spawn_client,
        test_sequence,
        test_otu,
    ):
        client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=client.user)

        await insert_otu(test_otu, reference.id, [test_sequence])

        resp = await client.get("/otus/6116cba1.fa")

        assert resp.status == HTTPStatus.OK

    async def test_not_found(self, spawn_client, resp_is):
        client = await spawn_client(authenticated=True)

        resp = await client.get("/otus/6116cba1.fa")

        await resp_is.not_found(resp)


class TestDownloadIsolate:
    async def test_ok(
        self,
        fake: DataFaker,
        insert_otu,
        spawn_client,
        test_otu,
        test_sequence,
    ):
        client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=client.user)

        await insert_otu(test_otu, reference.id, [test_sequence])

        isolate_id = test_otu["isolates"][0]["id"]

        resp = await client.get(f"/otus/6116cba1/isolates/{isolate_id}.fa")

        assert resp.status == HTTPStatus.OK

    async def test_otu_not_found(self, spawn_client, resp_is, test_otu):
        client = await spawn_client(authenticated=True)

        isolate_id = test_otu["isolates"][0]["id"]

        resp = await client.get(f"/otus/6116cba1/isolates/{isolate_id}.fa")

        await resp_is.not_found(resp)

    async def test_isolate_not_found(
        self,
        fake: DataFaker,
        insert_otu,
        spawn_client,
        resp_is,
        test_otu,
        test_sequence,
    ):
        client = await spawn_client(authenticated=True)

        reference = await fake.references.create(user=client.user)

        await insert_otu(test_otu, reference.id, [test_sequence])

        resp = await client.get("/otus/6116cba1/isolates/different.fa")

        await resp_is.not_found(resp)
