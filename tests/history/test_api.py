from http import HTTPStatus

import pytest
from syrupy import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.data.layer import DataLayer
from virtool.otus.oas import CreateOTURequest
from virtool.references.models import ReferenceDataType
from virtool.references.oas import CreateReferenceRequest


async def test_find(
    snapshot_recent: SnapshotAssertion,
    data_layer: DataLayer,
    spawn_client: ClientSpawner,
):
    """The global list returns processed change documents produced by real edits."""
    client = await spawn_client(authenticated=True)

    reference = await data_layer.references.create(
        CreateReferenceRequest(
            name="Test Reference",
            organism="virus",
            data_type=ReferenceDataType.genome,
        ),
        client.user.id,
    )

    await data_layer.otus.create(
        reference.id,
        CreateOTURequest(name="Tobacco mosaic virus", abbreviation="TMV"),
        client.user.id,
    )

    await data_layer.otus.create(
        reference.id,
        CreateOTURequest(name="Potato virus X", abbreviation="PVX"),
        client.user.id,
    )

    resp = await client.get("/history")

    assert resp.status == HTTPStatus.OK

    body = await resp.json()
    assert len(body["documents"]) == body["found_count"] == body["total_count"] == 2
    assert body == snapshot_recent


class TestFindValidation:
    """Out-of-range pagination query params are rejected at the API boundary.

    ``page`` and ``per_page`` are validated by the shared ``Page``/``PerPage``
    constrained types, so invalid values return ``400`` before reaching the
    pagination math rather than raising or silently falling back to defaults.
    """

    @pytest.mark.parametrize(
        "query",
        [
            "page=0",
            "page=-1",
            "page=notanumber",
            "per_page=0",
            "per_page=-1",
            "per_page=101",
            "per_page=notanumber",
        ],
    )
    async def test_rejects_invalid(
        self,
        query: str,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(authenticated=True)

        resp = await client.get(f"/history?{query}")

        assert resp.status == HTTPStatus.BAD_REQUEST


class TestGet:
    """Retrieve a single change document by its change id."""

    async def test_ok(
        self,
        snapshot_recent: SnapshotAssertion,
        data_layer: DataLayer,
        spawn_client: ClientSpawner,
    ):
        """A change produced by a real OTU creation is returned with its diff."""
        client = await spawn_client(authenticated=True)

        reference = await data_layer.references.create(
            CreateReferenceRequest(
                name="Test Reference",
                organism="virus",
                data_type=ReferenceDataType.genome,
            ),
            client.user.id,
        )

        otu = await data_layer.otus.create(
            reference.id,
            CreateOTURequest(name="Tobacco mosaic virus", abbreviation="TMV"),
            client.user.id,
        )

        resp = await client.get(f"/history/{otu.id}.0")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot_recent

    async def test_not_found(self, resp_is, spawn_client: ClientSpawner):
        """An unknown change id returns a ``404``."""
        client = await spawn_client(authenticated=True)

        resp = await client.get("/history/missing.1")

        await resp_is.not_found(resp)
