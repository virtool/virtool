from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.filters import paths

from virtool.fake.next import DataFaker
from virtool.indexes.sql import SQLIndex, SQLIndexFile
from virtool.pg.utils import (
    PgOptions,
    connect_pg,
    delete_row,
    get_row,
    get_row_by_id,
    get_rows,
)
from virtool.utils import timestamp


async def _seed_index(pg: AsyncEngine, fake: DataFaker, legacy_id: str) -> int:
    """Seed one ``indexes`` row keyed by ``legacy_id``; return its integer id.

    ``index_files`` rows carry a non-null integer FK to ``indexes``, so these
    generic helper tests need a real parent index to point at.
    """
    user = await fake.users.create()
    reference = await fake.references.create(user=user)
    job = await fake.jobs.create(user=user)

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndex(
                legacy_id=legacy_id,
                version=0,
                created_at=timestamp(),
                manifest={},
                ready=False,
                storage_key=legacy_id,
                reference_id=reference.id,
                user_id=user.id,
                job_id=job.id,
                task_id=None,
            ),
        )
        await session.commit()

        return await session.scalar(
            select(SQLIndex.id).where(SQLIndex.legacy_id == legacy_id),
        )


async def test_connect_pg(postgres_options: PgOptions, engine: AsyncEngine, snapshot):
    engine = await connect_pg(postgres_options)

    assert type(engine) is AsyncEngine
    assert engine.url._asdict() == snapshot(exclude=paths("port", "database"))


async def test_delete_row(fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                id=1,
                name="reference.1.bt2",
                index="foo",
                index_id=index_pk,
                type="bowtie2",
                size=1234567,
            )
        )
        await session.commit()

    await delete_row(pg, 1, SQLIndexFile)

    async with AsyncSession(pg) as session:
        assert await get_row_by_id(pg, SQLIndexFile, 1) is None


async def test_get_row(snapshot, fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    async with AsyncSession(pg) as session:
        session.add(
            SQLIndexFile(
                id=1,
                name="reference.1.bt2",
                index="foo",
                index_id=index_pk,
                type="bowtie2",
                size=1234567,
            )
        )
        await session.commit()

    assert await get_row_by_id(pg, SQLIndexFile, 1) == snapshot
    assert await get_row(pg, SQLIndexFile, ("index", "foo")) == snapshot


async def test_get_rows(snapshot, fake: DataFaker, pg: AsyncEngine):
    index_pk = await _seed_index(pg, fake, "foo")

    index_1 = SQLIndexFile(
        id=1,
        name="reference.1.bt2",
        index="foo",
        index_id=index_pk,
        type="bowtie2",
        size=1234567,
    )

    index_2 = SQLIndexFile(
        id=2,
        name="reference.2.bt2",
        index="foo",
        index_id=index_pk,
        type="bowtie2",
        size=1234567,
    )
    index_3 = SQLIndexFile(
        id=3,
        name="reference.3.bt2",
        index="foo",
        index_id=index_pk,
        type="bowtie2",
        size=1234567,
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2, index_3])
        await session.commit()

    assert await get_rows(pg, SQLIndexFile, "index", "foo") == snapshot
