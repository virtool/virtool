import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndexFile
from virtool.mongo.core import Mongo


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

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLIndexFile(
                    id=1,
                    name="reference.1.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=2,
                    name="reference.2.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=3,
                    name="reference.3.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=4,
                    name="reference.4.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=5,
                    name="reference.rev.1.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=6,
                    name="reference.rev.2.bt2",
                    index="foo",
                    type="bowtie2",
                    size=1234567,
                ),
                SQLIndexFile(
                    id=7,
                    name="reference.fa.gz",
                    index="foo",
                    type="fasta",
                    size=1234567,
                ),
            ],
        )
        await session.commit()

    # Ensure return value is correct.
    assert await data_layer.index.finalize("foo") == snapshot

    # Ensure document in database is correct.
    assert await mongo.indexes.find_one() == snapshot


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
