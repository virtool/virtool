import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.indexes.utils import compose_index_file_key


async def add_index_files(pg: AsyncEngine, index_id: int) -> None:
    """Add a complete set of built index files for ``index_id``."""
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
        session.add_all(
            [
                SQLIndexFile(
                    id=id_,
                    name=name,
                    index=str(index_id),
                    index_id=index_id,
                    type=type_,
                    size=1234567,
                )
                for id_, (name, type_) in enumerate(names, start=1)
            ],
        )
        await session.commit()


class TestDelete:
    async def test_resets_legacy_history_index(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
        static_time,
    ):
        """Deleting an index resets its ``legacy_history`` change records to the
        unbuilt sentinel, leaving changes built into other indexes alone.

        A failed build claims the reference's unbuilt history rows when it is
        created, so deleting the non-ready index must release them back to the
        unbuilt sentinel for the next build to pick up.
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
            ready=False,
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
                        index_id=deleted_index.id,
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
                        index_id=deleted_index.id,
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
                        index_id=other_index.id,
                    ),
                ],
            )
            await session.commit()

        await data_layer.index.delete(deleted_index.id)

        async with AsyncSession(pg) as session:
            rows = {
                row.legacy_id: row.index_id
                for row in (await session.execute(select(SQLLegacyHistory))).scalars()
            }

            index_row = await session.scalar(
                select(SQLIndex).where(SQLIndex.id == deleted_index.id),
            )

        assert rows == {
            "otu_a.0": None,
            "otu_b.0": None,
            "otu_c.0": other_index.id,
        }

        # The Postgres index row is hard-deleted.
        assert index_row is None

    async def test_deletes_index_files(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """Deleting a non-ready index removes its ``index_files`` rows.

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
            ready=False,
        )

        await add_index_files(pg, index.id)

        await data_layer.index.delete(index.id)

        async with AsyncSession(pg) as session:
            remaining = await session.scalar(
                select(func.count()).select_from(SQLIndexFile),
            )

        assert remaining == 0

    async def test_rejects_deletion_of_ready_index(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """A ready index cannot be deleted; the index row is left intact."""
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

        with pytest.raises(
            ResourceConflictError,
            match="Ready indexes cannot be deleted",
        ):
            await data_layer.index.delete(index.id)

        async with AsyncSession(pg) as session:
            assert (
                await session.scalar(
                    select(SQLIndex).where(SQLIndex.id == index.id),
                )
                is not None
            )


class TestResolveStorageKey:
    async def test_matches_legacy_id_at_landing(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        """At landing every migrated index carries ``storage_key == legacy_id``, so the
        composed object path stays keyed by the legacy slug even though the public id is
        now the integer primary key.
        """
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, manifest={}, version=2)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLIndex.legacy_id).where(SQLIndex.id == index.id),
            )

        storage_key = await data_layer.index._resolve_storage_key(index.id)

        assert storage_key == legacy_id
        assert (
            compose_index_file_key(storage_key, "otus.json.gz")
            == f"indexes/{legacy_id}/otus.json.gz"
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
                .where(SQLIndex.id == index.id)
                .values(storage_key="a-native-uuid-key"),
            )
            await session.commit()

        assert (
            await data_layer.index._resolve_storage_key(index.id) == "a-native-uuid-key"
        )

    async def test_not_found(self, data_layer: DataLayer):
        with pytest.raises(ResourceNotFoundError):
            await data_layer.index._resolve_storage_key(999999)
