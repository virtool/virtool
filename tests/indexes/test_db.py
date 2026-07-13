import pytest
from aiohttp.test_utils import make_mocked_coro
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.indexes.db
from virtool.data.topg import both_transactions
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.db import (
    attach_files,
    get_current_id_and_version,
    get_next_version,
    get_patched_otus,
    update_last_indexed_versions,
)
from virtool.indexes.sql import SQLIndexFile
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU


@pytest.mark.parametrize("index_id", [None, "abc"])
async def test_create(
    index_id: str | None,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    snapshot: SnapshotAssertion,
    static_time,
):
    """The new index embeds the integer ``legacy_references`` primary key of its
    reference rather than the legacy Mongo string id.
    """
    user = await fake.users.create()

    await fake.references.create(user=user, id_="foo")

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    assert (
        await virtool.indexes.db.create(
            mongo,
            pg,
            "foo",
            "test",
            "bar",
            index_id=index_id,
        )
        == snapshot
    )


async def test_create_assigns_index_in_postgres(
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """Building an index assigns previously-unbuilt changes for the reference to the
    new index in ``legacy_history``, leaving other references and already-built
    changes untouched.
    """
    user = await fake.users.create()

    built_ref = await fake.references.create(user=user, id_="built_ref")
    other_ref = await fake.references.create(user=user, id_="other_ref")

    await mongo.indexes.insert_one(
        {
            "_id": "prior_index",
            "reference": {"id": built_ref.id},
            "version": 0,
            "ready": True,
        },
    )

    def legacy_row(
        legacy_id: str, reference_id: int, index: str | None
    ) -> SQLLegacyHistory:
        return SQLLegacyHistory(
            legacy_id=legacy_id,
            created_at=static_time.datetime,
            description="",
            method_name="create_otu",
            user_id=user.id,
            otu=legacy_id,
            otu_name=legacy_id,
            otu_version="0",
            reference_id=reference_id,
            index=index,
            index_version="0" if index else None,
        )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                legacy_row("ref_unbuilt", built_ref.id, None),
                legacy_row("ref_already_built", built_ref.id, "prior_index"),
                legacy_row("other_ref_unbuilt", other_ref.id, None),
            ],
        )
        await session.commit()

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))

    await virtool.indexes.db.create(
        mongo,
        pg,
        "built_ref",
        user.id,
        1,
        index_id="new_index",
    )

    async with AsyncSession(pg) as session:
        rows = {
            row.legacy_id: (row.index, row.index_version)
            for row in (await session.execute(select(SQLLegacyHistory))).scalars()
        }

    assert rows["ref_unbuilt"] == ("new_index", "1")
    assert rows["ref_already_built"] == ("prior_index", "0")
    assert rows["other_ref_unbuilt"] == (None, None)


async def test_create_rolls_back_both_stores_on_failure(
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """A failure during the index build rolls back the Mongo index insert issued
    inside the transaction, leaving neither store with the index assignment.
    """
    user = await fake.users.create()

    built_ref = await fake.references.create(user=user, id_="built_ref")

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacyHistory(
                legacy_id="ref_unbuilt",
                created_at=static_time.datetime,
                description="",
                method_name="create_otu",
                user_id=user.id,
                otu="ref_unbuilt",
                otu_name="ref_unbuilt",
                otu_version="0",
                reference_id=built_ref.id,
                index=None,
                index_version=None,
            ),
        )
        await session.commit()

    mocker.patch("virtool.references.db.get_manifest", make_mocked_coro("manifest"))
    mocker.patch(
        "virtool.indexes.db.update",
        side_effect=RuntimeError("postgres write failed"),
    )

    with pytest.raises(RuntimeError, match="postgres write failed"):
        await virtool.indexes.db.create(
            mongo,
            pg,
            "built_ref",
            user.id,
            1,
            index_id="new_index",
        )

    assert await mongo.indexes.find_one("new_index") is None

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == "ref_unbuilt",
                ),
            )
        ).scalar_one()

    assert row.index is None
    assert row.index_version is None


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_current_id_and_version(
    exists, has_ref, test_indexes, mongo, pg: AsyncEngine
):
    if not exists:
        test_indexes = [dict(i, ready=False, has_files=False) for i in test_indexes]

    await mongo.indexes.insert_many(test_indexes, session=None)

    ref_id = "hxn167" if has_ref else "foobar"

    index_id, index_version = await get_current_id_and_version(mongo, pg, ref_id)

    if has_ref and exists:
        assert index_id == "ptlrcefm"
        assert index_version == 3

    else:
        assert index_id is None
        assert index_version == -1


@pytest.mark.parametrize("empty", [False, True])
@pytest.mark.parametrize("has_ref", [True, False])
async def test_get_next_version(empty, has_ref, test_indexes, mongo, pg: AsyncEngine):
    if not empty:
        await mongo.indexes.insert_many(test_indexes, session=None)

    expected = 4

    if empty or not has_ref:
        expected = 0

    assert (
        await get_next_version(mongo, pg, "hxn167" if has_ref else "foobar") == expected
    )


async def test_reads_tolerate_integer_embedded_reference_id(
    mongo: Mongo,
    pg: AsyncEngine,
    fake,
    static_time,
):
    """``get_current_id_and_version`` and ``get_next_version`` resolve the legacy
    string ref id and match an index whose embedded ``reference.id`` is the integer
    ``legacy_references`` primary key.
    """
    user = await fake.users.create()

    reference = await fake.references.create(user=user, id_="legacy_ref")

    await mongo.indexes.insert_one(
        {
            "_id": "built_index",
            "reference": {"id": reference.id},
            "version": 0,
            "ready": True,
        },
    )

    index_id, index_version = await get_current_id_and_version(mongo, pg, "legacy_ref")

    assert index_id == "built_index"
    assert index_version == 0
    assert await get_next_version(mongo, pg, "legacy_ref") == 1


async def test_get_patched_otus(mocker: MockerFixture, mongo: Mongo):
    m = mocker.patch(
        "virtool.history.db.patch_to_version",
        make_mocked_coro((None, {"_id": "foo"})),
    )

    pg = mocker.Mock()

    manifest = {"foo": 2, "bar": 10, "baz": 4}

    patched_otus = await get_patched_otus(mongo, pg, manifest)

    assert list(patched_otus) == [{"_id": "foo"}, {"_id": "foo"}, {"_id": "foo"}]

    m.assert_has_calls(
        [
            mocker.call(mongo, pg, "foo", 2),
            mocker.call(mongo, pg, "bar", 10),
            mocker.call(mongo, pg, "baz", 4),
        ],
    )


class TestUpdateLastIndexedVersions:
    async def test_stamps_both_stores(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """The stamp lands in Postgres as well as Mongo.

        The OTU is created through the data layer so it exists in both stores, as it
        would in production. Seeding Mongo alone would leave the Postgres update
        matching no rows and the test would pass without proving anything.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        otu = await fake.otus.create(reference.id, user)

        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await update_last_indexed_versions(
                mongo,
                pg,
                reference.id,
                mongo_session,
                pg_session,
            )

        document = await mongo.otus.find_one({"_id": otu.id})

        assert document["last_indexed_version"] == document["version"]

        async with AsyncSession(pg) as session:
            row = await session.scalar(select(SQLOTU).where(SQLOTU.id == otu.id))

        assert row.data["last_indexed_version"] == document["version"]

    async def test_otu_not_in_postgres(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        test_otu,
    ):
        """An OTU that has not been backfilled yet is stamped in Mongo and skipped in
        Postgres, rather than raising.

        The backfill carries the stamped Mongo document over, so there is nothing to
        write here.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        await mongo.otus.insert_one(
            {**test_otu, "reference": {"id": reference.id}, "version": 3},
        )

        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await update_last_indexed_versions(
                mongo,
                pg,
                reference.id,
                mongo_session,
                pg_session,
            )

        document = await mongo.otus.find_one({"_id": test_otu["_id"]})

        assert document["last_indexed_version"] == 3

        async with AsyncSession(pg) as session:
            assert (
                await session.scalar(
                    select(SQLOTU).where(SQLOTU.id == test_otu["_id"]),
                )
                is None
            )


async def test_attach_files(snapshot, pg: AsyncEngine):
    index_1 = SQLIndexFile(
        id=1,
        name="reference.1.bt2",
        index="foo",
        type="bowtie2",
        size=1234567,
    )
    index_2 = SQLIndexFile(
        id=2,
        name="reference.2.bt2",
        index="foo",
        type="bowtie2",
        size=1234567,
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2])
        await session.commit()

    document = {"_id": "foo", "reference": {"id": "bar"}}

    assert (
        await attach_files(pg, "https://virtool.example.com/api", document) == snapshot
    )
