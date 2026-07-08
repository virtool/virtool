import asyncio

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.api.client import UserClient
from virtool.data.errors import ResourceNotFoundError
from virtool.data.topg import compose_legacy_id_subquery
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.references.db import (
    check_right,
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


def make_client(mocker, *, user_id, groups, admin=False) -> UserClient:
    client = mocker.Mock(spec=UserClient)
    client.administrator_role = AdministratorRole.FULL if admin else None
    client.user_id = user_id
    client.groups = groups
    return client


class TestCheckRight:
    """Authorization reads resolve rights from the Postgres child tables."""

    async def test_administrator_short_circuit(
        self,
        mock_req,
        mocker,
        pg: AsyncEngine,
        fake: DataFaker,
    ):
        """A full administrator is granted any right without a database lookup."""
        user = await fake.users.create()

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(
            mocker,
            user_id=user.id,
            groups=[],
            admin=True,
        )

        assert await check_right(mock_req, "unseeded_reference", "modify") is True

    async def test_reference_not_found(
        self,
        mock_req,
        mocker,
        pg: AsyncEngine,
        fake: DataFaker,
    ):
        """A missing reference raises ``ResourceNotFoundError``."""
        user = await fake.users.create()

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=user.id, groups=[])

        with pytest.raises(ResourceNotFoundError):
            await check_right(mock_req, "missing_reference", "read")

    async def test_read_granted_by_user_membership(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=member.id, groups=[])

        assert await check_right(mock_req, "ref_read_user", "read") is True

    async def test_read_granted_by_group_membership(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(
            mocker,
            user_id=member.id,
            groups=[group.id],
        )

        assert await check_right(mock_req, "ref_read_group", "read") is True

    async def test_read_denied_for_non_member(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=outsider.id, groups=[])

        assert await check_right(mock_req, "ref_read_denied", "read") is False

    async def test_right_granted_by_user_entry(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=member.id, groups=[])

        assert await check_right(mock_req, "ref_user_right", "modify_otu") is True

    async def test_right_denied_when_no_entry_carries_it(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=member.id, groups=[])

        assert await check_right(mock_req, "ref_right_denied", "modify_otu") is False

    async def test_right_granted_by_group_when_user_entry_lacks_it(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(
            mocker,
            user_id=member.id,
            groups=[group.id],
        )

        assert await check_right(mock_req, "ref_group_wins", "modify_otu") is True

    async def test_group_matched_by_legacy_id(
        self,
        mock_req,
        mocker,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A client group held as a legacy string id resolves to its integer row."""
        owner = await fake.users.create()
        member = await fake.users.create()
        group = await fake.groups.create(legacy_id="legacy_group")

        await seed_reference_rights(
            pg,
            legacy_id="ref_legacy_group",
            owner_id=owner.id,
            created_at=static_time.datetime,
            groups=[(group.id, RIGHTS_NONE)],
        )

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(
            mocker,
            user_id=member.id,
            groups=[group.legacy_id],
        )

        assert await check_right(mock_req, "ref_legacy_group", "read") is True

    async def test_reference_matched_by_integer_pk(
        self,
        mock_req,
        mocker,
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

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=member.id, groups=[])

        assert await check_right(mock_req, reference_pk, "read") is True

    async def test_job_client_denied(
        self,
        mock_req,
        mocker,
        pg: AsyncEngine,
        fake: DataFaker,
        static_time,
    ):
        """A client without a user id or groups is denied without erroring."""
        owner = await fake.users.create()

        await seed_reference_rights(
            pg,
            legacy_id="ref_job_client",
            owner_id=owner.id,
            created_at=static_time.datetime,
        )

        mock_req.app = {"pg": pg}
        mock_req["client"] = make_client(mocker, user_id=None, groups=[])

        assert await check_right(mock_req, "ref_job_client", "read") is False


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
        """A Postgres-native reference contributes its integer id and no legacy id."""
        match = await compose_reference_ids_match(pg, False)

        assert set(match["$in"]) == {
            references["active"],
            references["native_active"],
            "ref_active",
        }


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
    assert await mongo.references.find_one({"_id": ref_id}) is None

    async with AsyncSession(pg) as pg_session:
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

    assert diff_count == 0
    assert legacy_count == 0


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
