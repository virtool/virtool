from http import HTTPStatus

from syrupy import SnapshotAssertion

from tests.fixtures.client import JobClientSpawner
from virtool.fake.next import DataFaker


class TestGet:
    """The jobs API serves a single reference by id."""

    async def test_ok(
        self,
        fake: DataFaker,
        snapshot_recent: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        owner = await fake.users.create()

        reference = await fake.references.create(
            user=owner,
            name="Bar",
            organism="virus",
        )

        await fake.indexes.create(reference, owner, version=0, ready=True)

        resp = await client.get(f"/references/v1/{reference.id}")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot_recent

    async def test_legacy_id(
        self,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """A reference that still has a legacy id is addressable by it."""
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()

        reference = await fake.references.create(user=user, id_="legacy_reference")

        resp = await client.get("/references/v1/legacy_reference")

        assert resp.status == HTTPStatus.OK
        assert (await resp.json())["id"] == reference.id

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/references/v1/bar")

        assert resp.status == HTTPStatus.NOT_FOUND
