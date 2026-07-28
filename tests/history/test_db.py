import datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.history.db
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.indexes.sql import SQLIndex
from virtool.models.enums import HistoryMethod
from virtool.otus.oas import CreateOTURequest
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


async def ensure_index(
    session: AsyncSession,
    legacy_id: str,
    reference_id: int,
    user_id: int,
) -> int:
    """Return the integer id of the ``indexes`` row for ``legacy_id``, creating it if
    it does not yet exist.
    """
    index_id = (
        await session.execute(
            select(SQLIndex.id).where(SQLIndex.legacy_id == legacy_id),
        )
    ).scalar_one_or_none()

    if index_id is None:
        version = (
            await session.execute(
                select(func.count())
                .select_from(SQLIndex)
                .where(SQLIndex.reference_id == reference_id),
            )
        ).scalar_one()

        index = SQLIndex(
            legacy_id=legacy_id,
            version=version,
            created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
            manifest={},
            ready=True,
            storage_key=legacy_id,
            reference_id=reference_id,
            user_id=user_id,
        )
        session.add(index)
        await session.flush()
        index_id = index.id

    return index_id


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
        reference_id = await ensure_reference(session, reference, user_id)
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
                reference_id=reference_id,
                index=index,
                index_id=(
                    None
                    if index is None
                    else await ensure_index(session, index, reference_id, user_id)
                ),
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


class TestFind:
    """``find`` reconstructs the index from ``index_id`` and keys the unbuilt filter on
    it, so the integer index id is exposed and unbuilt rows are never dropped.
    """

    async def seed(self, pg: AsyncEngine, fake: DataFaker) -> int:
        """Seed one built and one unbuilt change against ``reference_a``.

        The built change's index carries ``version=3`` so the reconstructed version,
        now read from ``indexes.version`` through the join rather than a stored copy,
        is a non-trivial value. Returns the integer primary key of the seeded index.
        """
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            reference_id = await ensure_reference(session, "reference_a", user.id)

            index = SQLIndex(
                legacy_id="idx_legacy",
                version=3,
                created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                manifest={},
                ready=True,
                storage_key="idx_legacy",
                reference_id=reference_id,
                user_id=user.id,
            )
            session.add(index)
            await session.flush()
            index_pk = index.id

            session.add_all(
                [
                    SQLLegacyHistory(
                        legacy_id="otu_a.1",
                        created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                        description="Built change",
                        method_name="edit",
                        user_id=user.id,
                        otu="otu_a",
                        otu_name="Virus A",
                        otu_version="1",
                        reference_id=reference_id,
                        index="idx_legacy",
                        index_id=index_pk,
                    ),
                    SQLLegacyHistory(
                        legacy_id="otu_a.0",
                        created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                        description="Unbuilt change",
                        method_name="create",
                        user_id=user.id,
                        otu="otu_a",
                        otu_name="Virus A",
                        otu_version="0",
                        reference_id=reference_id,
                        index=None,
                        index_id=None,
                    ),
                ],
            )
            await session.commit()

        return index_pk

    async def test_reconstructs_index_sentinels(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A built change exposes its integer index id; an unbuilt change reconstructs a
        ``None`` index rather than a sentinel object.
        """
        index_pk = await self.seed(pg, fake)

        result = await virtool.history.db.find(pg, 1, 25, reference_id="reference_a")

        indexes = {
            document["id"]: document["index"] for document in result["documents"]
        }

        assert indexes["otu_a.1"] == {"id": index_pk, "version": 3}
        assert indexes["otu_a.0"] is None

    async def test_unfiltered_keeps_unbuilt(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The outer join keeps unbuilt rows in the unfiltered listing."""
        await self.seed(pg, fake)

        result = await virtool.history.db.find(pg, 1, 25, reference_id="reference_a")

        assert result["found_count"] == 2
        assert {document["id"] for document in result["documents"]} == {
            "otu_a.0",
            "otu_a.1",
        }

    async def test_unbuilt_true_returns_only_unbuilt(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        await self.seed(pg, fake)

        result = await virtool.history.db.find(
            pg, 1, 25, reference_id="reference_a", unbuilt=True
        )

        assert {document["id"] for document in result["documents"]} == {"otu_a.0"}

    async def test_unbuilt_false_returns_only_built(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        await self.seed(pg, fake)

        result = await virtool.history.db.find(
            pg, 1, 25, reference_id="reference_a", unbuilt=False
        )

        assert {document["id"] for document in result["documents"]} == {"otu_a.1"}

    async def test_native_index_uses_integer_pk(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A Postgres-native index (no ``legacy_id``) exposes its integer primary key as
        the public index id.
        """
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            reference_id = await ensure_reference(session, "reference_a", user.id)

            index = SQLIndex(
                legacy_id=None,
                version=4,
                created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                manifest={},
                ready=True,
                storage_key="native_index",
                reference_id=reference_id,
                user_id=user.id,
            )
            session.add(index)
            await session.flush()
            index_pk = index.id

            session.add(
                SQLLegacyHistory(
                    legacy_id="otu_a.1",
                    created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                    description="Built change",
                    method_name="edit",
                    user_id=user.id,
                    otu="otu_a",
                    otu_name="Virus A",
                    otu_version="1",
                    reference_id=reference_id,
                    index=str(index_pk),
                    index_id=index_pk,
                ),
            )
            await session.commit()

        result = await virtool.history.db.find(pg, 1, 25, reference_id="reference_a")

        indexes = {
            document["id"]: document["index"] for document in result["documents"]
        }

        assert indexes["otu_a.1"] == {"id": index_pk, "version": 4}


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
    build_otu_history,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    otu_id = await build_otu_history(remove=remove)

    current, patched = await virtool.history.db.patch_to_version(
        pg,
        otu_id,
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
    build_otu_history,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
):
    """Patching to an intermediate version unwinds only the changes above it, stopping
    at the first change at or below the target version.
    """
    otu_id = await build_otu_history(remove=False)

    current, patched = await virtool.history.db.patch_to_version(
        pg,
        otu_id,
        2,
    )

    assert current == snapshot(name="current")
    assert patched == snapshot(name="patched")


class TestPatchOTUsToVersions:
    """``patch_otus_to_versions`` patches a whole set of OTUs in one batched read.

    It is where the patching lives -- :func:`patch_to_version` is a single-OTU face on
    it -- so a specifier patched alongside others has to resolve to exactly what it
    resolves to alone.
    """

    @pytest.mark.parametrize("remove", [True, False])
    async def test_same_otu_at_two_versions(
        self,
        remove: bool,
        build_otu_history,
        pg: AsyncEngine,
    ):
        """An OTU patched to two versions at once resolves as each version does alone.

        The history for the set is read only as far back as the lowest version any of
        its OTUs is being patched to, so the specifier bound for the higher version is
        handed rows reaching past its own target that it must not revert.
        """
        otu_id = await build_otu_history(remove=remove)

        specifiers = [(otu_id, 1), (otu_id, 2)]

        patched_otus = await virtool.history.db.patch_otus_to_versions(pg, specifiers)

        assert len(patched_otus) == 2

        for specifier in specifiers:
            assert patched_otus[specifier] == await virtool.history.db.patch_to_version(
                pg,
                *specifier,
            )

    async def test_patches_each_otu_from_its_own_history(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Every OTU is patched from its own changes, not another OTU's.

        The whole set's history comes back from one query, so the rows have to be
        bucketed by OTU here rather than by the ``WHERE`` clause.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        otu_ids = []

        for name, abbreviation in (
            ("Prunus virus F", "PVF"),
            ("Cherry virus A", "CVA"),
        ):
            otu = await data_layer.otus.create(
                reference.id,
                CreateOTURequest(name=name, abbreviation=abbreviation),
                user.id,
            )

            await data_layer.otus.add_isolate(otu.id, "isolate", "8816-v2", user.id)

            otu_ids.append(otu.id)

        specifiers = [(otu_id, 0) for otu_id in otu_ids]

        patched_otus = await virtool.history.db.patch_otus_to_versions(pg, specifiers)

        for specifier in specifiers:
            assert patched_otus[specifier] == await virtool.history.db.patch_to_version(
                pg,
                *specifier,
            )

        # The isolate each OTU gained at version 1 is unwound, and neither OTU comes
        # back as the other.
        assert [
            (patched_otus[specifier][1]["name"], patched_otus[specifier][1]["isolates"])
            for specifier in specifiers
        ] == [("Prunus virus F", []), ("Cherry virus A", [])]

    async def test_no_specifiers(self, pg: AsyncEngine):
        """Asking for no OTUs is empty rather than an error or every OTU."""
        assert await virtool.history.db.patch_otus_to_versions(pg, []) == {}


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
