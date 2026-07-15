import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.history.db
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.pg.utils import get_row_by_id
from virtool.references.sql import SQLReference
from virtool.workflow.pytest_plugin.utils import StaticTime


async def ensure_reference(
    session: AsyncSession,
    legacy_id: str,
    user_id: int,
) -> int:
    """Return the integer id of the ``legacy_references`` row for ``legacy_id``,
    creating it if it does not yet exist.
    """
    reference_id = (
        await session.execute(
            select(SQLReference.id).where(SQLReference.legacy_id == legacy_id),
        )
    ).scalar_one_or_none()

    if reference_id is None:
        reference = SQLReference(
            legacy_id=legacy_id,
            name=legacy_id,
            description="",
            created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
            source_types=[],
            user_id=user_id,
        )
        session.add(reference)
        await session.flush()
        reference_id = reference.id

    return reference_id


async def add_contribution(
    pg: AsyncEngine,
    change_id: str,
    user_id: int,
    reference: str,
    index: str | None = None,
) -> None:
    """Insert a single ``legacy_history`` row for contributor-counting tests."""
    async with AsyncSession(pg) as session:
        otu_id, otu_version = change_id.split(".")
        session.add(
            SQLLegacyHistory(
                legacy_id=change_id,
                created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                description="Description",
                method_name="update",
                user_id=user_id,
                otu=otu_id,
                otu_name="Prunus virus F",
                otu_version=otu_version,
                reference=reference,
                reference_id=await ensure_reference(session, reference, user_id),
                index=index,
                index_version=None if index is None else "1",
            ),
        )
        await session.commit()


class TestGetContributors:
    async def test_by_reference(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
    ):
        """Contributions are grouped and counted per user, scoped to the reference."""
        prolific = await fake.users.create()
        occasional = await fake.users.create()
        other_reference_only = await fake.users.create()

        await add_contribution(pg, "otu_a.0", prolific.id, "reference_a")
        await add_contribution(pg, "otu_a.1", prolific.id, "reference_a")
        await add_contribution(pg, "otu_b.0", occasional.id, "reference_a")
        await add_contribution(pg, "otu_c.0", other_reference_only.id, "reference_b")

        contributors = await virtool.history.db.get_contributors(
            pg,
            reference_id="reference_a",
        )

        assert contributors == snapshot

    async def test_by_index(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
    ):
        """Only changes included in the requested built index are counted."""
        builder = await fake.users.create()

        await add_contribution(
            pg, "otu_a.0", builder.id, "reference_a", index="index_1"
        )
        await add_contribution(
            pg, "otu_a.1", builder.id, "reference_a", index="index_1"
        )
        await add_contribution(
            pg, "otu_b.0", builder.id, "reference_a", index="index_2"
        )

        contributors = await virtool.history.db.get_contributors(
            pg,
            index_id="index_1",
        )

        assert contributors == snapshot

    async def test_empty(self, pg: AsyncEngine):
        """A reference with no history yields no contributors."""
        assert (
            await virtool.history.db.get_contributors(pg, reference_id="reference_a")
            == []
        )

    async def test_requires_scope(self, pg: AsyncEngine):
        """An unscoped call raises instead of aggregating the whole table."""
        with pytest.raises(
            ValueError,
            match="get_contributors requires a reference_id or index_id",
        ):
            await virtool.history.db.get_contributors(pg)


class TestAdd:
    async def test_edit(
        self,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        fake,
        test_otu_edit,
    ):
        """An edit writes a normal-version ``legacy_history`` row and its diff."""
        old, new = test_otu_edit

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            await ensure_reference(session, "hxn167", user.id)
            await session.commit()

        async with AsyncSession(pg) as session:
            change = await virtool.history.db.add(
                session,
                "This is a description",
                HistoryMethod.edit,
                old,
                new,
                user.id,
            )
            await session.commit()

        change_id = change["_id"]

        assert change == snapshot

        async with AsyncSession(pg) as session:
            diff = await session.execute(
                select(SQLLegacyHistoryDiff.diff).where(
                    SQLLegacyHistoryDiff.change_id == change_id,
                ),
            )

            assert diff.scalar_one_or_none() == snapshot

            legacy = await session.execute(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == change_id,
                ),
            )

            assert legacy.scalar_one() == snapshot(name="legacy_history")

    async def test_create(
        self,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        fake,
        test_otu_edit,
    ):
        """A standalone create writes a normal-version ``legacy_history`` row."""
        # There is no old document because this is a change document for an otu creation
        # operation.
        old = None

        new, _ = test_otu_edit

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            await ensure_reference(session, "hxn167", user.id)
            await session.commit()

        async with AsyncSession(pg) as session:
            change = await virtool.history.db.add(
                session,
                f"Created {new['name']}",
                HistoryMethod.create,
                old,
                new,
                user.id,
            )
            await session.commit()

        assert change == snapshot
        assert await get_row_by_id(pg, SQLLegacyHistoryDiff, 1) == snapshot

        async with AsyncSession(pg) as session:
            legacy = await session.execute(
                select(SQLLegacyHistory).where(
                    SQLLegacyHistory.legacy_id == change["_id"],
                ),
            )

            assert legacy.scalar_one() == snapshot(name="legacy_history")

    async def test_remove(
        self,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        fake,
        test_otu_edit,
    ):
        """A ``"removed"`` version normalizes ``otu_version`` to ``NULL``."""
        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            await ensure_reference(session, "hxn167", user.id)
            await session.commit()

        async with AsyncSession(pg) as session:
            change = await virtool.history.db.add(
                session,
                f"Removed {old['name']}",
                HistoryMethod.remove,
                old,
                new,
                user.id,
            )
            await session.commit()

        assert change == snapshot(name="return_value")

        diff = await get_row_by_id(pg, SQLLegacyHistoryDiff, 1)

        assert diff == snapshot(name="diff")

        async with AsyncSession(pg) as session:
            legacy = (
                await session.execute(
                    select(SQLLegacyHistory).where(
                        SQLLegacyHistory.legacy_id == change["_id"],
                    ),
                )
            ).scalar_one()

        assert legacy.otu_version is None
        assert legacy.index is None
        assert legacy.index_version is None
        assert legacy == snapshot(name="legacy_history")


class TestGetMostRecentChange:
    async def test_ok(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time: StaticTime,
    ):
        """The change with the highest ``otu_version`` for the otu is returned."""
        user = await fake.users.create()

        delta = datetime.timedelta(3)

        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLLegacyHistory(
                        legacy_id="6116cba1.1",
                        created_at=static_time.datetime - delta,
                        description="Description",
                        method_name="update",
                        user_id=user.id,
                        otu="6116cba1",
                        otu_name="Prunus virus F",
                        otu_version="1",
                        reference="hxn167",
                        index=None,
                        index_version=None,
                    ),
                    SQLLegacyHistory(
                        legacy_id="6116cba1.2",
                        created_at=static_time.datetime,
                        description="Description number 2",
                        method_name="update",
                        user_id=user.id,
                        otu="6116cba1",
                        otu_name="Prunus virus F",
                        otu_version="2",
                        reference="hxn167",
                        index=None,
                        index_version=None,
                    ),
                ],
            )

            await session.commit()

        return_value = await virtool.history.db.get_most_recent_change(pg, "6116cba1")

        assert return_value == snapshot

    async def test_does_not_exist(self, pg: AsyncEngine):
        """``None`` is returned when the otu has no history."""
        assert await virtool.history.db.get_most_recent_change(pg, "6116cba1") is None


@pytest.mark.parametrize("remove", [True, False])
async def test_patch_to_version(
    remove: bool,
    create_mock_history,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    await create_mock_history(remove=remove)

    current, patched = await virtool.history.db.patch_to_version(
        pg,
        "6116cba1",
        1,
    )

    assert current == snapshot(name="current")
    assert patched == snapshot(name="patched")


def test_stamp_reference():
    """Stamping overwrites ``reference.id`` on the OTU and every nested sequence with
    the authoritative integer id, replacing whatever stale value a diff carried.
    """
    otu = {
        "_id": "6116cba1",
        "reference": {"id": "hxn167"},
        "isolates": [
            {
                "id": "cab8b360",
                "sequences": [
                    {"_id": "KX269872", "reference": {"id": "hxn167"}},
                    {"_id": "KX269873", "reference": {"id": "hxn167"}},
                ],
            },
            {"id": "bcb8b361", "sequences": [{"_id": "KX269874"}]},
        ],
    }

    virtool.history.db._stamp_reference(otu, 42)

    assert otu["reference"] == {"id": 42}
    assert [
        sequence["reference"]
        for isolate in otu["isolates"]
        for sequence in isolate["sequences"]
    ] == [{"id": 42}, {"id": 42}, {"id": 42}]


async def test_patch_to_version_intermediate(
    create_mock_history,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    """Patching to an intermediate version unwinds only the changes above it, stopping
    at the first change at or below the target version.
    """
    await create_mock_history(remove=False)

    current, patched = await virtool.history.db.patch_to_version(
        pg,
        "6116cba1",
        2,
    )

    assert current == snapshot(name="current")
    assert patched == snapshot(name="patched")


async def test_patch_to_version_missing_diff(
    fake: DataFaker,
    pg: AsyncEngine,
):
    """A ``legacy_history`` change with no matching ``SQLLegacyHistoryDiff`` row raises
    a clear error instead of failing later with a ``KeyError``.
    """
    user = await fake.users.create()

    await add_contribution(pg, "6116cba1.1", user.id, "hxn167")

    with pytest.raises(
        ValueError,
        match="Missing legacy_history_diff rows.*6116cba1.1",
    ):
        await virtool.history.db.patch_to_version(pg, "6116cba1", 0)


async def test_resolve_diffs_inline_diff(pg: AsyncEngine):
    """A change holding an unbackfilled inline diff raises instead of being treated as
    a literal diff.
    """
    with pytest.raises(
        ValueError,
        match="Unexpected inline diff for change 6116cba1.1",
    ):
        await virtool.history.db._resolve_diffs(
            pg,
            [{"_id": "6116cba1.1", "diff": [["change", "version", [0, 1]]]}],
        )
