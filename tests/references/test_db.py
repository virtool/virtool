import asyncio
from datetime import datetime

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.api.custom_json import dump_string, loads
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.data.topg import compose_legacy_id_subquery
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.db import (
    compose_reference_ids_match,
    create_document,
    get_manifest,
    get_reference_groups,
    populate_insert_only_reference,
)
from virtool.references.sql import (
    SQLReference,
    SQLReferenceGroup,
    SQLReferenceUser,
)


def build_source_otus(indices: list[int]) -> list[dict]:
    """Build source OTU documents for the bulk reference populate paths."""
    return [
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
        for i in indices
    ]


async def seed_reference(
    pg: AsyncEngine,
    legacy_id: str,
    user_id: int,
    created_at,
) -> None:
    """Insert a ``legacy_references`` row so history writes can resolve its FK."""
    async with AsyncSession(pg) as session:
        session.add(
            SQLReference(
                legacy_id=legacy_id,
                name=legacy_id,
                description="",
                created_at=created_at,
                source_types=[],
                user_id=user_id,
            ),
        )
        await session.commit()


RIGHTS_NONE = {"build": False, "modify": False, "modify_otu": False}
RIGHTS_MODIFY_OTU = {"build": False, "modify": False, "modify_otu": True}


async def seed_reference_rights(
    pg: AsyncEngine,
    *,
    legacy_id: str,
    owner_id: int,
    created_at,
    users: list[tuple[int, dict]] | None = None,
    groups: list[tuple[int, dict]] | None = None,
) -> int:
    """Insert a reference plus its user and group rights child rows.

    :return: the reference's Postgres primary key
    """
    async with AsyncSession(pg) as session:
        reference = SQLReference(
            legacy_id=legacy_id,
            name=legacy_id,
            description="",
            created_at=created_at,
            source_types=[],
            user_id=owner_id,
        )
        session.add(reference)
        await session.flush()

        reference_id = reference.id

        for user_id, rights in users or []:
            session.add(
                SQLReferenceUser(
                    reference_id=reference_id,
                    user_id=user_id,
                    **rights,
                ),
            )

        for group_id, rights in groups or []:
            session.add(
                SQLReferenceGroup(
                    reference_id=reference_id,
                    group_id=group_id,
                    **rights,
                ),
            )

        await session.commit()

        return reference_id


class TestCheckRight:
    """Authorization reads resolve rights from the Postgres child tables."""

    async def test_administrator_short_circuit(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A full administrator is granted any right without a database lookup."""
        user = await fake.users.create()

        assert (
            await data_layer.references.check_right(
                "unseeded_reference",
                "modify",
                user_id=user.id,
                group_ids=[],
                administrator=True,
            )
            is True
        )

    async def test_reference_not_found(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """A missing reference raises ``ResourceNotFoundError``."""
        user = await fake.users.create()

        with pytest.raises(ResourceNotFoundError):
            await data_layer.references.check_right(
                "missing_reference",
                "read",
                user_id=user.id,
                group_ids=[],
                administrator=False,
            )

    async def test_read_granted_by_user_membership(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A user listed on the reference has ``read`` access."""
        owner = await fake.users.create()
        member = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_read_user",
            owner_id=owner.id,
            created_at=static_time.datetime,
            users=[(member.id, RIGHTS_NONE)],
        )

        assert (
            await data_layer.references.check_right(
                "ref_read_user",
                "read",
                user_id=member.id,
                group_ids=[],
                administrator=False,
            )
            is True
        )

    async def test_read_granted_by_group_membership(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A member of a group listed on the reference has ``read`` access."""
        owner = await fake.users.create()
        member = await fake.users.create()
        group = await fake.groups.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_read_group",
            owner_id=owner.id,
            created_at=static_time.datetime,
            groups=[(group.id, RIGHTS_NONE)],
        )

        assert (
            await data_layer.references.check_right(
                "ref_read_group",
                "read",
                user_id=member.id,
                group_ids=[group.id],
                administrator=False,
            )
            is True
        )

    async def test_read_denied_for_non_member(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A user with no membership is denied ``read`` access."""
        owner = await fake.users.create()
        outsider = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_read_denied",
            owner_id=owner.id,
            created_at=static_time.datetime,
        )

        assert (
            await data_layer.references.check_right(
                "ref_read_denied",
                "read",
                user_id=outsider.id,
                group_ids=[],
                administrator=False,
            )
            is False
        )

    async def test_right_granted_by_user_entry(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A user entry that carries the right grants it."""
        owner = await fake.users.create()
        member = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_user_right",
            owner_id=owner.id,
            created_at=static_time.datetime,
            users=[(member.id, RIGHTS_MODIFY_OTU)],
        )

        assert (
            await data_layer.references.check_right(
                "ref_user_right",
                "modify_otu",
                user_id=member.id,
                group_ids=[],
                administrator=False,
            )
            is True
        )

    async def test_right_denied_when_no_entry_carries_it(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A member whose entries all lack the right is denied it."""
        owner = await fake.users.create()
        member = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_right_denied",
            owner_id=owner.id,
            created_at=static_time.datetime,
            users=[(member.id, RIGHTS_NONE)],
        )

        assert (
            await data_layer.references.check_right(
                "ref_right_denied",
                "modify_otu",
                user_id=member.id,
                group_ids=[],
                administrator=False,
            )
            is False
        )

    async def test_right_granted_by_group_when_user_entry_lacks_it(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A member group's right grants access even when the user entry lacks it.

        The user entry does not short-circuit to a denial; group rights are still
        evaluated.
        """
        owner = await fake.users.create()
        member = await fake.users.create()
        group = await fake.groups.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_group_wins",
            owner_id=owner.id,
            created_at=static_time.datetime,
            users=[(member.id, RIGHTS_NONE)],
            groups=[(group.id, RIGHTS_MODIFY_OTU)],
        )

        assert (
            await data_layer.references.check_right(
                "ref_group_wins",
                "modify_otu",
                user_id=member.id,
                group_ids=[group.id],
                administrator=False,
            )
            is True
        )

    async def test_reference_matched_by_integer_pk(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A reference addressed by its integer primary key resolves correctly."""
        owner = await fake.users.create()
        member = await fake.users.create()

        reference_pk = await seed_reference_rights(
            pg,
            legacy_id="ref_by_pk",
            owner_id=owner.id,
            created_at=static_time.datetime,
            users=[(member.id, RIGHTS_NONE)],
        )

        assert (
            await data_layer.references.check_right(
                reference_pk,
                "read",
                user_id=member.id,
                group_ids=[],
                administrator=False,
            )
            is True
        )

    async def test_client_without_user_denied(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A client with no user id or groups is denied without erroring."""
        owner = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_job_client",
            owner_id=owner.id,
            created_at=static_time.datetime,
        )

        assert (
            await data_layer.references.check_right(
                "ref_job_client",
                "read",
                user_id=None,
                group_ids=[],
                administrator=False,
            )
            is False
        )


class TestComposeReferenceIdsMatch:
    """The lifecycle facet of the index find query, sourced from Postgres.

    Indexes embed either the legacy string reference id or the integer primary key
    during the migration, so both forms must appear in the match for every reference
    that passes the lifecycle filter.
    """

    @pytest.fixture
    async def references(self, fake: DataFaker, pg: AsyncEngine, static_time):
        """Seed an active, an archived, and a Postgres-native active reference."""
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            rows = {
                "active": SQLReference(
                    legacy_id="ref_active",
                    name="active",
                    description="",
                    created_at=static_time.datetime,
                    archived=False,
                    source_types=[],
                    user_id=user.id,
                ),
                "archived": SQLReference(
                    legacy_id="ref_archived",
                    name="archived",
                    description="",
                    created_at=static_time.datetime,
                    archived=True,
                    source_types=[],
                    user_id=user.id,
                ),
                "native_active": SQLReference(
                    legacy_id=None,
                    name="native_active",
                    description="",
                    created_at=static_time.datetime,
                    archived=False,
                    source_types=[],
                    user_id=user.id,
                ),
            }

            session.add_all(rows.values())
            await session.flush()

            reference_ids = {key: row.id for key, row in rows.items()}

            await session.commit()

        return reference_ids

    async def test_unfiltered(self, pg: AsyncEngine, references: dict[str, int]):
        """Both id forms of every reference are matched when ``archived`` is None."""
        match = await compose_reference_ids_match(pg)

        assert set(match["$in"]) == {
            references["active"],
            references["archived"],
            references["native_active"],
            "ref_active",
            "ref_archived",
        }

    async def test_archived(self, pg: AsyncEngine, references: dict[str, int]):
        match = await compose_reference_ids_match(pg, True)

        assert set(match["$in"]) == {references["archived"], "ref_archived"}

    async def test_active(self, pg: AsyncEngine, references: dict[str, int]):
        match = await compose_reference_ids_match(pg, False)

        assert set(match["$in"]) == {
            references["active"],
            references["native_active"],
            "ref_active",
        }

    async def test_native_reference_contributes_only_its_pk(
        self,
        pg: AsyncEngine,
        references: dict[str, int],
    ):
        """A reference with no ``legacy_id`` is matched by its primary key alone.

        Now that the integer primary key is the public identifier, a Postgres-native
        reference can be shaped into a ``ReferenceNested``. Its ``NULL`` legacy id must
        not leak into the match, where it would match indexes with no reference.
        """
        match = await compose_reference_ids_match(pg)

        assert references["native_active"] in match["$in"]
        assert None not in match["$in"]


async def test_create_manifest(mongo: Mongo, pg: AsyncEngine, test_otu: dict):
    await mongo.otus.insert_many(
        [
            test_otu,
            {**test_otu, "_id": "foo", "version": 5},
            {**test_otu, "_id": "baz", "version": 3, "reference": {"id": "123"}},
            {**test_otu, "_id": "bar", "version": 11},
        ],
        session=None,
    )

    assert await get_manifest(mongo, pg, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11,
    }


async def test_get_reference_groups(
    fake: DataFaker,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """Groups are read from the child table and enriched with name and legacy id."""
    owner = await fake.users.create()
    group_1 = await fake.groups.create()
    group_2 = await fake.groups.create(legacy_id="group_2")

    reference_pk = await seed_reference_rights(
        pg,
        legacy_id="ref_groups",
        owner_id=owner.id,
        created_at=static_time.datetime,
        groups=[
            (group_1.id, RIGHTS_NONE),
            (group_2.id, RIGHTS_MODIFY_OTU),
        ],
    )

    assert (
        await get_reference_groups(pg, reference_pk, static_time.datetime) == snapshot
    )


async def test_create_document_owner_user(
    static_time,
):
    from virtool.settings.models import Settings

    settings = Settings(default_source_types=["isolate", "strain"])

    document = await create_document(
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

    await seed_reference(pg, ref_id, user.id, static_time.datetime)

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

    otus = build_source_otus([1, 2])

    otus_done = asyncio.Event()

    real_otus_insert_many = mongo.otus.insert_many

    async def wrapped_otus_insert_many(documents, session):
        try:
            return await real_otus_insert_many(documents, session)
        finally:
            otus_done.set()

    async def fail_sequences_insert_many(documents, session):
        # Wait for the sibling OTU insert to actually land so the rollback has
        # real Mongo state to clean up — otherwise the test would pass
        # trivially against empty collections.
        await asyncio.wait_for(otus_done.wait(), timeout=5.0)
        raise RuntimeError("forced mongo failure")

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
    assert await mongo.sequences.count_documents({"reference.id": ref_id}) == 0

    async with AsyncSession(pg) as pg_session:
        reference_row = await pg_session.scalar(
            select(SQLReference).where(SQLReference.legacy_id == ref_id),
        )

        assert reference_row is None

        diff_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistoryDiff)
            .where(SQLLegacyHistoryDiff.change_id.in_(["rbotu001.0", "rbotu002.0"])),
        )

        legacy_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistory)
            .where(SQLLegacyHistory.legacy_id.in_(["rbotu001.0", "rbotu002.0"])),
        )

        otu_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLOTU)
            .where(SQLOTU.id.in_(["rbotu001", "rbotu002"])),
        )

        sequence_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLSequence)
            .where(SQLSequence.id.in_(["rbseq001", "rbseq002"])),
        )

    assert diff_count == 0
    assert legacy_count == 0
    assert otu_count == 0
    assert sequence_count == 0


async def test_populate_insert_only_reference_writes_legacy_history(
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

    await seed_reference(pg, ref_id, user.id, static_time.datetime)

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

    otus = build_source_otus([1, 2])

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
                    select(SQLLegacyHistory)
                    .where(
                        SQLLegacyHistory.reference_id
                        == compose_legacy_id_subquery(SQLReference, ref_id),
                    )
                    .order_by(SQLLegacyHistory.legacy_id),
                )
            )
            .scalars()
            .all()
        )

    assert [row.legacy_id for row in rows] == ["lhotu001.0", "lhotu002.0"]
    assert all(row.user_id == user.id for row in rows)
    assert all(row.reference is None and row.reference_id is not None for row in rows)
    assert all(row.otu_version == "0" for row in rows)
    assert all(row.index is None and row.index_version is None for row in rows)
    assert rows == snapshot(name="legacy_history")


async def test_populate_insert_only_reference_writes_otu_and_sequence_rows(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """A successful bulk insert writes a ``legacy_otus`` row per OTU and a
    ``legacy_sequences`` row per sequence, with promoted columns and verbatim data.
    """
    user = await fake.users.create()
    ref_id = "ref_otu_rows_test"

    await seed_reference(pg, ref_id, user.id, static_time.datetime)

    mocker.patch(
        "virtool.references.alot.random_alphanumeric",
        side_effect=[
            "orotu001",
            "oriso001",
            "orseq001",
            "orotu002",
            "oriso002",
            "orseq002",
        ],
    )

    await populate_insert_only_reference(
        static_time.datetime,
        HistoryMethod.remote,
        mongo,
        pg,
        build_source_otus([1, 2]),
        ref_id,
        user.id,
    )

    async with AsyncSession(pg) as pg_session:
        reference_pk = await pg_session.scalar(
            select(SQLReference.id).where(SQLReference.legacy_id == ref_id),
        )

        otu_rows = (
            (
                await pg_session.execute(
                    select(SQLOTU)
                    .where(SQLOTU.reference_id == reference_pk)
                    .order_by(SQLOTU.id),
                )
            )
            .scalars()
            .all()
        )

        sequence_rows = (
            (
                await pg_session.execute(
                    select(SQLSequence)
                    .where(SQLSequence.otu_id.in_([row.id for row in otu_rows]))
                    .order_by(SQLSequence.id),
                )
            )
            .scalars()
            .all()
        )

    assert [row.id for row in otu_rows] == ["orotu001", "orotu002"]
    assert [row.name for row in otu_rows] == ["OTU 1", "OTU 2"]
    assert [row.abbreviation for row in otu_rows] == ["O1", "O2"]
    assert all(row.reference_id == reference_pk for row in otu_rows)
    assert all(row.version == 0 for row in otu_rows)
    assert all(row.data["reference"]["id"] == reference_pk for row in otu_rows)

    assert [row.id for row in sequence_rows] == ["orseq001", "orseq002"]
    assert [row.otu_id for row in sequence_rows] == ["orotu001", "orotu002"]
    assert [row.isolate_id for row in sequence_rows] == ["oriso001", "oriso002"]

    assert otu_rows == snapshot(name="legacy_otus")
    assert sequence_rows == snapshot(name="legacy_sequences")


async def test_populate_insert_only_reference_stores_created_at_faithfully(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
):
    """The ``legacy_otus.data`` written by a bulk populate is a faithful lift of the
    Mongo document, including a ``created_at`` with microsecond precision.

    This is the one write path that hands Postgres a datetime that never round-tripped
    through Mongo: the same in-memory dicts go to ``bulk_insert_otu_rows`` and to
    ``mongo.otus.insert_many``. Mongo floors a datetime to the millisecond, so without
    a matching truncation Postgres would hold a finer instant than Mongo does and the
    store parity check would report every imported OTU as drifted.

    ``static_time`` cannot catch this: its ``created_at`` has no microseconds to lose.
    """
    user = await fake.users.create()
    ref_id = "ref_created_at_test"

    created_at = datetime(2015, 10, 6, 20, 0, 0, 123456)

    await seed_reference(pg, ref_id, user.id, created_at)

    mocker.patch(
        "virtool.references.alot.random_alphanumeric",
        side_effect=["caotu001", "caiso001", "caseq001"],
    )

    await populate_insert_only_reference(
        created_at,
        HistoryMethod.remote,
        mongo,
        pg,
        build_source_otus([1]),
        ref_id,
        user.id,
    )

    document = await mongo.otus.find_one({"_id": "caotu001"})

    assert document["created_at"] == datetime(2015, 10, 6, 20, 0, 0, 123000)

    async with AsyncSession(pg) as pg_session:
        row = await pg_session.scalar(select(SQLOTU).where(SQLOTU.id == "caotu001"))

    assert row.data == loads(dump_string(document))


async def test_populate_insert_only_reference_chunks_inserts(
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time,
):
    """OTUs spanning multiple per-chunk commits all land in both stores."""
    user = await fake.users.create()
    ref_id = "ref_chunk_test"

    await seed_reference(pg, ref_id, user.id, static_time.datetime)

    mocker.patch("virtool.references.db._REFERENCE_OTU_CHUNK_SIZE", 1)
    mocker.patch(
        "virtool.references.alot.random_alphanumeric",
        side_effect=[
            "ckotu001",
            "ckiso001",
            "ckseq001",
            "ckotu002",
            "ckiso002",
            "ckseq002",
            "ckotu003",
            "ckiso003",
            "ckseq003",
        ],
    )

    await populate_insert_only_reference(
        static_time.datetime,
        HistoryMethod.remote,
        mongo,
        pg,
        build_source_otus([1, 2, 3]),
        ref_id,
        user.id,
    )

    assert await mongo.otus.count_documents({}) == 3
    assert await mongo.sequences.count_documents({}) == 3

    async with AsyncSession(pg) as pg_session:
        otu_count = await pg_session.scalar(select(func.count()).select_from(SQLOTU))
        sequence_count = await pg_session.scalar(
            select(func.count()).select_from(SQLSequence),
        )
        history_count = await pg_session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistory)
            .where(
                SQLLegacyHistory.reference_id
                == compose_legacy_id_subquery(SQLReference, ref_id),
            ),
        )

    assert otu_count == 3
    assert sequence_count == 3
    assert history_count == 3
