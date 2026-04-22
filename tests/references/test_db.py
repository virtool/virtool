import asyncio

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.api.client import UserClient
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.references.db import (
    check_right,
    create_document,
    fetch_and_update_release,
    get_manifest,
    get_reference_groups,
    populate_insert_only_reference,
)
from virtool.startup import startup_http_client_session


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except TypeError:
        pass


@pytest.mark.parametrize("is_administrator", [True, False])
@pytest.mark.parametrize("membership", [None, "group", "user"])
@pytest.mark.parametrize(
    "right,expect",
    [("read", True), ("modify_otu", True), ("modify", False)],
)
async def test_check_right(
    is_administrator: bool,
    expect: bool,
    membership: str | None,
    right: str,
    mock_req,
    mocker,
    mongo: Mongo,
):
    mock_req.app = {"mongo": mongo}

    mock_req["client"] = mocker.Mock(spec=UserClient)
    mock_req["client"].administrator_role = (
        AdministratorRole.FULL if is_administrator else None
    )
    mock_req["client"].user_id = "bar"
    mock_req["client"].groups = ["foo"]

    await mongo.references.insert_one(
        {
            "_id": "baz",
            "groups": [
                {
                    "id": "foo" if membership == "group" else "none",
                    "read": True,
                    "modify": False,
                    "modify_otu": True,
                },
            ],
            "users": [
                {
                    "id": "bar" if membership == "user" else "none",
                    "read": True,
                    "modify": False,
                    "modify_otu": True,
                },
            ],
        },
    )

    result = await check_right(mock_req, "baz", right)

    if is_administrator:
        assert result is True
    elif membership is None:
        assert result is False
    else:
        assert result is expect


async def test_create_manifest(mongo: Mongo, test_otu: dict):
    await mongo.otus.insert_many(
        [
            test_otu,
            {**test_otu, "_id": "foo", "version": 5},
            {**test_otu, "_id": "baz", "version": 3, "reference": {"id": "123"}},
            {**test_otu, "_id": "bar", "version": 11},
        ],
        session=None,
    )

    assert await get_manifest(mongo, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11,
    }


async def test_fetch_and_update_release(mongo: Mongo, fake_app, snapshot, static_time):
    await startup_http_client_session(fake_app)

    await mongo.references.insert_one(
        {
            "_id": "fake_ref_id",
            "installed": {"name": "1.0.0-fake-install"},
            "release": {"name": "1.0.0-fake-release"},
            "remotes_from": {"slug": "virtool/ref-plant-viruses"},
        },
    )

    assert (
        await fetch_and_update_release(mongo, fake_app["client"], "fake_ref_id", False)
        == snapshot
    )


async def test_get_reference_groups(
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    """Test that reference groups are returned whether they have integer or string ids."""
    group_1 = await fake.groups.create()
    group_2 = await fake.groups.create(legacy_id="group_2")

    assert (
        await get_reference_groups(
            pg,
            {
                "groups": [
                    {
                        "id": group_1.id,
                        "build": False,
                        "modify": False,
                        "modify_otu": False,
                        "remove": False,
                    },
                    {
                        "id": group_2.legacy_id,
                        "build": False,
                        "modify": True,
                        "modify_otu": True,
                        "remove": True,
                    },
                ],
            },
        )
        == snapshot
    )


async def test_create_document_owner_user(
    mongo: Mongo,
    static_time,
):
    from virtool.settings.models import Settings

    settings = Settings(default_source_types=["isolate", "strain"])

    document = await create_document(
        mongo,
        settings,
        "Test Reference",
        "virus",
        "Test description",
        "genome",
        static_time.datetime,
        user_id="fred",
    )

    # Verify the owner user was created correctly
    assert len(document["users"]) == 1
    owner_user = document["users"][0]
    assert owner_user == {
        "id": "fred",
        "build": True,
        "modify": True,
        "modify_otu": True,
        "created_at": static_time.datetime,
        "remove": True,
    }


async def test_populate_insert_only_reference_rollback(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time,
):
    """When a Mongo write fails, rollback removes the ``history_diffs`` rows
    written during the PostgreSQL phase and all Mongo state scoped to the
    reference, leaving the database as it was before the call.
    """
    user = await fake.users.create()
    ref_id = "ref_rollback_test"

    await mongo.references.insert_one(
        {
            "_id": ref_id,
            "created_at": static_time.datetime,
            "data_type": "genome",
            "name": "Rollback",
            "user": {"id": user.id},
        },
    )

    mocker.patch(
        "virtool.references.alot.random_alphanumeric",
        side_effect=[
            "rbotu001",
            "rbiso001",
            "rbseq001",
            "rbotu002",
            "rbiso002",
            "rbseq002",
        ],
    )

    otus = [
        {
            "_id": f"remote_{i}",
            "name": f"OTU {i}",
            "abbreviation": f"O{i}",
            "isolates": [
                {
                    "id": f"remote_iso_{i}",
                    "default": True,
                    "source_type": "isolate",
                    "source_name": "a",
                    "sequences": [
                        {
                            "_id": f"remote_seq_{i}",
                            "accession": f"ACC{i}",
                            "sequence": "ATCG",
                            "definition": "test",
                            "host": "h",
                        },
                    ],
                },
            ],
        }
        for i in (1, 2)
    ]

    async def fail_sequences_insert(documents, session):
        # Yield to let the other gather tasks progress before raising, so the
        # rollback has real Mongo state to clean up.
        await asyncio.sleep(0.05)
        raise RuntimeError("forced mongo failure")

    mocker.patch.object(mongo.sequences, "insert_many", fail_sequences_insert)

    with pytest.raises(RuntimeError, match="forced mongo failure"):
        await populate_insert_only_reference(
            static_time.datetime,
            HistoryMethod.remote,
            mongo,
            pg,
            otus,
            ref_id,
            user.id,
        )

    assert await mongo.otus.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.history.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.sequences.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.references.find_one({"_id": ref_id}) is None

    async with AsyncSession(pg) as pg_session:
        count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLHistoryDiff)
            .where(SQLHistoryDiff.change_id.in_(["rbotu001.0", "rbotu002.0"])),
        )

    assert count == 0
