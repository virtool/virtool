import asyncio

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.indexes.models import SQLIndexFile
from virtool.mongo.core import Mongo


async def test_finalize(
    data_layer: DataLayer,
    fake2: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot,
    static_time,
):
    user = await fake2.users.create()
    job = await fake2.jobs.create(user=user)

    await asyncio.gather(
        mongo.references.insert_one(
            {"_id": "bar", "name": "Bar", "data_type": "genome"}
        ),
        mongo.indexes.insert_one(
            {
                "_id": "foo",
                "reference": {"id": "bar"},
                "user": {"id": user.id},
                "version": 2,
                "created_at": static_time.datetime,
                "job": {"id": job.id},
                "has_files": True,
                "manifest": {},
            }
        ),
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
            ]
        )
        await session.commit()

    # Ensure return value is correct.
    assert await data_layer.index.finalize("foo") == snapshot

    # Ensure document in database is correct.
    assert await mongo.indexes.find_one() == snapshot
