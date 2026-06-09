import asyncio

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.api.client import UserClient
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLHistoryDiff, SQLLegacyHistory
from virtool.models.enums import HistoryMethod
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.references.db import (
    check_right,
    compose_archived_filter,
    compose_rights_filter,
    create_document,
    fetch_and_update_release,
    get_manifest,
    get_reference_groups,
    populate_insert_only_reference,
)
from virtool.references.models import ReferenceRights
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

    rights = ReferenceRights(
        build=False,
        modify=False,
        modify_otu=True,
        remove=False,
    ).dict()

    await mongo.references.insert_one(
        {
            "_id": "baz",
            "archived": False,
            "groups": [
                {
                    "id": "foo" if membership == "group" else "none",
                    **rights,
                },
            ],
            "users": [
                {
                    "id": "bar" if membership == "user" else "none",
                    **rights,
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


class TestComposeArchivedFilter:
    """The lifecycle facet of the references find query."""

    @pytest.mark.parametrize(
        ("archived", "expected"),
        [
            (None, {}),
            (True, {"archived": True}),
            (False, {"archived": False}),
        ],
    )
    def test(self, archived, expected):
        assert compose_archived_filter(archived) == expected


class TestComposeRightsFilter:
    """The user-rights facet of the references find query."""

    def test_administrator(self):
        """Administrators bypass the rights filter."""
        assert (
            compose_rights_filter(
                user_id=7,
                administrator=True,
                groups=["foo"],
            )
            == {}
        )

    def test_non_administrator(self):
        """Non-administrators get an ``$or`` over their group and user id."""
        assert compose_rights_filter(
            user_id=7,
            administrator=False,
            groups=["foo"],
        ) == {
            "$or": [
                {"groups.id": {"$in": ["foo"]}},
                {"users.id": 7},
                {"user.id": 7},
            ],
        }


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
            "archived": False,
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

    history_done = asyncio.Event()
    otus_done = asyncio.Event()

    real_history_insert_many = mongo.history.insert_many
    real_otus_insert_many = mongo.otus.insert_many

    async def wrapped_history_insert_many(documents, session):
        try:
            return await real_history_insert_many(documents, session)
        finally:
            history_done.set()

    async def wrapped_otus_insert_many(documents, session):
        try:
            return await real_otus_insert_many(documents, session)
        finally:
            otus_done.set()

    async def fail_sequences_insert_many(documents, session):
        # Wait for the sibling inserts to actually land so the rollback has
        # real Mongo state to clean up — otherwise the test would pass
        # trivially against empty collections.
        await asyncio.wait_for(
            asyncio.gather(history_done.wait(), otus_done.wait()),
            timeout=5.0,
        )
        raise RuntimeError("forced mongo failure")

    mocker.patch.object(mongo.history, "insert_many", wrapped_history_insert_many)
    mocker.patch.object(mongo.otus, "insert_many", wrapped_otus_insert_many)
    mocker.patch.object(mongo.sequences, "insert_many", fail_sequences_insert_many)

    with pytest.raises(ExceptionGroup) as excinfo:
        await populate_insert_only_reference(
            static_time.datetime,
            HistoryMethod.remote,
            mongo,
            pg,
            otus,
            ref_id,
            user.id,
        )

    assert excinfo.group_contains(RuntimeError, match="forced mongo failure")

    assert await mongo.otus.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.history.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.sequences.count_documents({"reference.id": ref_id}) == 0
    assert await mongo.references.find_one({"_id": ref_id}) is None

    async with AsyncSession(pg) as pg_session:
        diff_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLHistoryDiff)
            .where(SQLHistoryDiff.change_id.in_(["rbotu001.0", "rbotu002.0"])),
        )

        legacy_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistory)
            .where(SQLLegacyHistory.legacy_id.in_(["rbotu001.0", "rbotu002.0"])),
        )

    assert diff_count == 0
    assert legacy_count == 0


async def test_populate_insert_only_reference_dual_writes_legacy_history(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """A successful bulk insert writes one ``legacy_history`` row per OTU."""
    user = await fake.users.create()
    ref_id = "ref_legacy_test"

    mocker.patch(
        "virtool.references.alot.random_alphanumeric",
        side_effect=[
            "lhotu001",
            "lhiso001",
            "lhseq001",
            "lhotu002",
            "lhiso002",
            "lhseq002",
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

    await populate_insert_only_reference(
        static_time.datetime,
        HistoryMethod.remote,
        mongo,
        pg,
        otus,
        ref_id,
        user.id,
    )

    async with AsyncSession(pg) as pg_session:
        rows = (
            (
                await pg_session.execute(
                    select(SQLLegacyHistory).order_by(SQLLegacyHistory.legacy_id),
                )
            )
            .scalars()
            .all()
        )

    assert [row.legacy_id for row in rows] == ["lhotu001.0", "lhotu002.0"]
    assert all(row.user_id == user.id for row in rows)
    assert all(row.reference == ref_id for row in rows)
    assert all(row.otu_version == "0" for row in rows)
    assert all(row.index is None and row.index_version is None for row in rows)
    assert rows == snapshot(name="legacy_history")
