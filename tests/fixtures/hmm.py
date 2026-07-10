import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.hmm.sql import SQLHMM, SQLHMMStatus


@pytest.fixture
def seed_hmm_status(pg):
    """Return a function that seeds the HMM status singleton row in Postgres."""

    async def func(document: dict) -> None:
        task = document.get("task")

        async with AsyncSession(pg) as session:
            session.add(
                SQLHMMStatus(
                    id=1,
                    errors=document.get("errors", []),
                    installed=document.get("installed"),
                    release=document.get("release"),
                    task_id=task["id"] if task else None,
                    updates=document.get("updates", []),
                ),
            )
            await session.commit()

    return func


@pytest.fixture
def seed_pg_hmm(pg):
    """Return a function that mirrors a Mongo HMM annotation document into Postgres.

    The Mongo ``_id`` is stored in ``legacy_id``, matching the dual-write done by
    ``HmmsData.install``.
    """

    async def func(document: dict) -> None:
        async with AsyncSession(pg) as session:
            session.add(
                SQLHMM(
                    legacy_id=document["_id"],
                    cluster=document["cluster"],
                    count=document["count"],
                    length=document["length"],
                    mean_entropy=document["mean_entropy"],
                    total_entropy=document["total_entropy"],
                    hidden=document.get("hidden", False),
                    names=document["names"],
                    families=document["families"],
                    genera=document["genera"],
                    entries=document["entries"],
                ),
            )
            await session.commit()

    return func
