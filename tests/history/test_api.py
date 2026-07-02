import asyncio
from http import HTTPStatus

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.fixtures.client import ClientSpawner
from virtool.history.db import bulk_insert_diffs, legacy_history_values
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo


async def test_find(
    snapshot,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    test_changes,
    static_time,
):
    """Test that a list of processed change documents are returned with a ``200`` status."""
    client = await spawn_client(authenticated=True)

    changes = [{**c, "user": {"id": client.user.id}} for c in test_changes]

    await mongo.references.insert_one(
        {
            "_id": "hxn167",
            "archived": False,
            "data_type": "genome",
            "name": "Reference A",
        },
    )

    async with AsyncSession(pg) as session:
        for change in changes:
            session.add(SQLLegacyHistory(**legacy_history_values(change)))

        await session.commit()

    resp = await client.get("/history")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error,
    snapshot,
    resp_is,
    mongo: Mongo,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    test_changes,
    static_time,
):
    """Test that a specific history change can be retrieved by its change_id."""
    client = await spawn_client(authenticated=True)

    await bulk_insert_diffs(
        pg,
        [{"change_id": c["_id"], "diff": c["diff"]} for c in test_changes],
    )

    await asyncio.gather(
        mongo.history.insert_many(
            [
                {**c, "diff": "postgres", "user": {"id": client.user.id}}
                for c in test_changes
            ],
            session=None,
        ),
        mongo.references.insert_one(
            {
                "_id": "hxn167",
                "archived": False,
                "data_type": "genome",
                "name": "Reference A",
            },
        ),
    )

    change_id = "baz.1" if error else "6116cba1.1"

    resp = await client.get(f"/history/{change_id}")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("remove", [False, True])
async def test_revert(
    error,
    remove,
    snapshot,
    create_mock_history,
    mongo: Mongo,
    spawn_client: ClientSpawner,
    check_ref_right,
    resp_is,
):
    """Test that a valid request results in a reversion and a ``204`` response."""
    client = await spawn_client(authenticated=True)

    await create_mock_history(remove)

    change_id = "foo.1" if error else "6116cba1.2"

    resp = await client.delete("/history/" + change_id)

    if error:
        await resp_is.not_found(resp)
        return

    if not check_ref_right:
        await resp_is.insufficient_rights(resp)
        return

    await resp_is.no_content(resp)

    assert await mongo.otus.find_one() == snapshot
    assert await mongo.history.find().to_list(None) == snapshot
    assert await mongo.sequences.find().to_list(None) == snapshot
