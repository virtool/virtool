import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndexFile
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU


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
        session.add_all(
            [
                SQLIndexFile(
                    id=id_,
                    name=name,
                    index=index_id,
                    type=type_,
                    size=1234567,
                )
                for id_, (name, type_) in enumerate(names, start=1)
            ],
        )
        await session.commit()


async def test_finalize(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot,
    static_time,
):
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)
    reference = await fake.references.create(user=user)

    await mongo.indexes.insert_one(
        {
            "_id": "foo",
            "reference": {"id": reference.id},
            "user": {"id": user.id},
            "version": 2,
            "created_at": static_time.datetime,
            "job": {"id": job.id},
            "task": None,
            "has_files": True,
            "manifest": {},
        },
    )

    await add_index_files(pg, "foo")

    # Ensure return value is correct.
    assert await data_layer.index.finalize("foo") == snapshot

    # Ensure document in database is correct.
    assert await mongo.indexes.find_one() == snapshot


async def test_finalize_stamps_last_indexed_version(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time,
):
    """Finalizing an index stamps ``last_indexed_version`` in Postgres as well as
    Mongo, so ``legacy_otus`` does not drift from the OTU document it mirrors.
    """
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)

    reference = await fake.references.create(user=user)
    otu = await fake.otus.create(reference.id, user)

    await mongo.indexes.insert_one(
        {
            "_id": "foo",
            "reference": {"id": reference.id},
            "user": {"id": user.id},
            "version": 2,
            "created_at": static_time.datetime,
            "job": {"id": job.id},
            "has_files": True,
            "manifest": {},
        },
    )

    await add_index_files(pg, "foo")

    await data_layer.index.finalize("foo")

    document = await mongo.otus.find_one({"_id": otu.id})

    assert document["last_indexed_version"] == document["version"]

    async with AsyncSession(pg) as session:
        row = await session.scalar(select(SQLOTU).where(SQLOTU.id == otu.id))

    assert row.data["last_indexed_version"] == document["version"]


async def test_finalize_reference_missing_from_postgres(
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    static_time,
):
    """An index whose reference has no Postgres row is corrupt data, not a missing
    resource.
    """
    user = await fake.users.create()
    job = await fake.jobs.create(user=user)

    await mongo.indexes.insert_one(
        {
            "_id": "foo",
            "reference": {"id": "missing"},
            "user": {"id": user.id},
            "version": 2,
            "created_at": static_time.datetime,
            "job": {"id": job.id},
            "has_files": True,
            "manifest": {},
        },
    )

    with pytest.raises(ResourceError, match="Could not find reference missing"):
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

        await mongo.indexes.insert_one(
            {
                "_id": "deleted_index",
                "reference": {"id": reference.id},
                "user": {"id": user.id},
                "version": 4,
                "created_at": static_time.datetime,
                "job": {"id": job.id},
                "task": None,
                "has_files": True,
                "ready": True,
                "manifest": {},
            },
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
                        index="deleted_index",
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
                        index="deleted_index",
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
                        index="other_index",
                        index_version="2",
                    ),
                ],
            )
            await session.commit()

        await data_layer.index.delete("deleted_index")

        assert await mongo.indexes.find_one("deleted_index") is None

        async with AsyncSession(pg) as session:
            rows = {
                row.legacy_id: (row.index, row.index_version)
                for row in (await session.execute(select(SQLLegacyHistory))).scalars()
            }

        assert rows == {
            "otu_a.0": (None, None),
            "otu_b.0": (None, None),
            "otu_c.0": ("other_index", "2"),
        }
