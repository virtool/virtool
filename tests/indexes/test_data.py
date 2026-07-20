import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
)
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.utils import compose_index_file_key
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU
from virtool.utils import timestamp


async def add_index_files(pg: AsyncEngine, index_id: str) -> None:
    """Add the complete set of files that finalizing ``index_id`` requires.

    Finalization blocks on the bowtie2 and FASTA checks, so an index missing any of
    these never reaches the code under test.
    """
    names = [
        ("reference.1.bt2", "bowtie2"),
        ("reference.2.bt2", "bowtie2"),
        ("reference.3.bt2", "bowtie2"),
        ("reference.4.bt2", "bowtie2"),
        ("reference.rev.1.bt2", "bowtie2"),
        ("reference.rev.2.bt2", "bowtie2"),
        ("reference.fa.gz", "fasta"),
    ]

    async with AsyncSession(pg) as session:
        index_pk = await session.scalar(
            select(SQLIndex.id).where(SQLIndex.legacy_id == index_id),
        )

        session.add_all(
            [
                SQLIndexFile(
                    id=id_,
                    name=name,
                    index=index_id,
                    index_id=index_pk,
                    type=type_,
                    size=1234567,
                )
                for id_, (name, type_) in enumerate(names, start=1)
            ],
        )
        await session.commit()


@pytest.mark.usefixtures("static_time")
async def test_finalize(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot,
):
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)
    reference = await fake.references.create(user=user)

    index = await fake.indexes.create(
        reference,
        user,
        job=job,
        manifest={},
        version=2,
    )

    await add_index_files(pg, index.id)

    # Ensure return value is correct.
    assert await data_layer.index.finalize(index.id) == snapshot

    # Ensure document in database is correct.
    assert await mongo.indexes.find_one() == snapshot

    # The Postgres row is marked ready alongside the Mongo document.
    async with AsyncSession(pg) as session:
        row = await session.scalar(
            select(SQLIndex).where(SQLIndex.legacy_id == index.id),
        )

    assert row.ready is True


@pytest.mark.usefixtures("static_time")
async def test_finalize_stamps_last_indexed_version(
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
):
    """Finalizing an index stamps ``last_indexed_version`` on the promoted column and
    its ``data`` counterpart, so ``legacy_otus`` does not drift from itself.
    """
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)

    reference = await fake.references.create(user=user)
    otu = await fake.otus.create(reference.id, user)

    index = await fake.indexes.create(
        reference,
        user,
        job=job,
        manifest={},
        version=2,
    )

    await add_index_files(pg, index.id)

    await data_layer.index.finalize(index.id)

    async with AsyncSession(pg) as session:
        row = await session.scalar(select(SQLOTU).where(SQLOTU.id == otu.id))

    assert row.last_indexed_version == row.version
    assert row.data["last_indexed_version"] == row.version


async def test_finalize_index_missing_from_postgres(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    static_time,
):
    """An index with no Postgres row cannot finalize and marks nothing ready.

    Finalize reads the index and its reference straight off ``SQLIndex`` now, so a
    Mongo-only index — one whose Postgres row was never written — has no reference to
    resolve and fails loudly instead of silently promoting the Mongo document.
    """
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)

    # Seeded by hand rather than through ``fake.indexes``: the faker dual-writes the
    # Postgres row, so it cannot express the Mongo-only index this test is about.
    await mongo.indexes.insert_one(
        {
            "_id": "foo",
            "reference": {"id": "missing"},
            "user": {"id": user.id},
            "version": 2,
            "created_at": static_time.datetime,
            "job": {"id": job.id},
            "manifest": {},
        },
    )

    with pytest.raises(ResourceError, match="Could not find index reference id"):
        await data_layer.index.finalize("foo")

    assert await mongo.indexes.find_one("foo", ["ready"]) == {"_id": "foo"}


class TestDelete:
    async def test_resets_legacy_history_index(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
        static_time,
    ):
        """Deleting an index resets its ``legacy_history`` change records to the
        unbuilt sentinel, leaving changes built into other indexes alone.
        """
        user = await fake.users.create()
        job = await fake.jobs.create(user=user)
        reference = await fake.references.create(user=user)

        deleted_index = await fake.indexes.create(
            reference,
            user,
            job=job,
            manifest={},
            version=4,
            ready=True,
        )

        other_index = await fake.indexes.create(
            reference,
            user,
            job=job,
            manifest={},
            version=2,
            ready=True,
        )

        async with AsyncSession(pg) as session:
            deleted_index_pk = await session.scalar(
                select(SQLIndex.id).where(SQLIndex.legacy_id == deleted_index.id),
            )
            other_index_pk = await session.scalar(
                select(SQLIndex.id).where(SQLIndex.legacy_id == other_index.id),
            )

            session.add_all(
                [
                    SQLLegacyHistory(
                        legacy_id="otu_a.0",
                        created_at=static_time.datetime,
                        description="Created A",
                        method_name="create",
                        user_id=user.id,
                        otu="otu_a",
                        otu_name="Virus A",
                        otu_version="0",
                        reference_id=reference.id,
                        index=deleted_index.id,
                        index_id=deleted_index_pk,
                        index_version="4",
                    ),
                    SQLLegacyHistory(
                        legacy_id="otu_b.0",
                        created_at=static_time.datetime,
                        description="Created B",
                        method_name="create",
                        user_id=user.id,
                        otu="otu_b",
                        otu_name="Virus B",
                        otu_version="0",
                        reference_id=reference.id,
                        index=deleted_index.id,
                        index_id=deleted_index_pk,
                        index_version="4",
                    ),
                    SQLLegacyHistory(
                        legacy_id="otu_c.0",
                        created_at=static_time.datetime,
                        description="Created C",
                        method_name="create",
                        user_id=user.id,
                        otu="otu_c",
                        otu_name="Virus C",
                        otu_version="0",
                        reference_id=reference.id,
                        index=other_index.id,
                        index_id=other_index_pk,
                        index_version="2",
                    ),
                ],
            )
            await session.commit()

        await data_layer.index.delete(deleted_index.id)

        assert await mongo.indexes.find_one(deleted_index.id) is None

        async with AsyncSession(pg) as session:
            rows = {
                row.legacy_id: (row.index, row.index_id, row.index_version)
                for row in (await session.execute(select(SQLLegacyHistory))).scalars()
            }

            index_row = await session.scalar(
                select(SQLIndex).where(SQLIndex.legacy_id == deleted_index.id),
            )

        assert rows == {
            "otu_a.0": (None, None, None),
            "otu_b.0": (None, None, None),
            "otu_c.0": (other_index.id, other_index_pk, "2"),
        }

        # The Postgres index row is deleted alongside the Mongo document.
        assert index_row is None

    async def test_deletes_index_files(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Deleting a built index removes its ``index_files`` rows.

        The ``index_id`` foreign key cascades on delete, so hard-deleting the index
        row takes its file rows with it rather than raising a foreign-key violation.
        """
        user = await fake.users.create()
        job = await fake.jobs.create(user=user)
        reference = await fake.references.create(user=user)

        index = await fake.indexes.create(
            reference,
            user,
            job=job,
            manifest={},
            version=2,
            ready=True,
        )

        await add_index_files(pg, index.id)

        await data_layer.index.delete(index.id)

        async with AsyncSession(pg) as session:
            remaining = await session.scalar(
                select(func.count()).select_from(SQLIndexFile),
            )

        assert remaining == 0

    async def test_rejects_deletion_when_referenced_by_analysis(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """An index that any analysis references cannot be deleted; both stores are
        left intact.
        """
        user = await fake.users.create()
        job = await fake.jobs.create(user=user)
        reference = await fake.references.create(user=user)

        index = await fake.indexes.create(
            reference,
            user,
            job=job,
            version=0,
            ready=True,
        )

        async with AsyncSession(pg) as session:
            index_pk = await session.scalar(
                select(SQLIndex.id).where(SQLIndex.legacy_id == index.id),
            )
            now = timestamp()
            session.add(
                SQLAnalysis(
                    created_at=now,
                    updated_at=now,
                    workflow="nuvs",
                    ready=False,
                    sample="sample_legacy",
                    reference=str(reference.id),
                    index=index.id,
                    index_id=index_pk,
                    user_id=user.id,
                ),
            )
            await session.commit()

        with pytest.raises(
            ResourceConflictError,
            match="referenced by one or more analyses",
        ):
            await data_layer.index.delete(index.id)

        assert await mongo.indexes.find_one(index.id) is not None

        async with AsyncSession(pg) as session:
            assert (
                await session.scalar(
                    select(SQLIndex).where(SQLIndex.legacy_id == index.id),
                )
                is not None
            )


class TestResolveStorageKey:
    async def test_matches_legacy_id_at_landing(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
    ):
        """At landing every migrated index carries ``storage_key == legacy_id``, so the
        composed object path is byte-identical to keying by the index id.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, manifest={}, version=2)

        storage_key = await data_layer.index._resolve_storage_key(index.id)

        assert storage_key == index.id
        assert (
            compose_index_file_key(storage_key, "otus.json.gz")
            == f"indexes/{index.id}/otus.json.gz"
        )

    async def test_uses_storage_key_column(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """The resolver reads ``storage_key``, so a native UUID key addresses storage
        independently of the public index id.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, manifest={}, version=2)

        async with AsyncSession(pg) as session:
            await session.execute(
                update(SQLIndex)
                .where(SQLIndex.legacy_id == index.id)
                .values(storage_key="a-native-uuid-key"),
            )
            await session.commit()

        assert (
            await data_layer.index._resolve_storage_key(index.id) == "a-native-uuid-key"
        )

    async def test_not_found(self, data_layer: DataLayer):
        with pytest.raises(ResourceNotFoundError):
            await data_layer.index._resolve_storage_key("missing")
