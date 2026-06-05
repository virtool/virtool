"""Tests for the copy hmm annotations to postgres migration."""

import asyncio
from collections.abc import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_6v3b3vunad16_copy_hmm_annotations_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def apply_table(ctx: MigrationContext, apply_alembic: Callable) -> None:
    """Create the ``hmms`` table the backfill writes into."""
    await asyncio.to_thread(apply_alembic, required_alembic_revision)


def make_hmm_document(hmm_id: str, *, cluster: int = 2, hidden: bool = False) -> dict:
    """Create a MongoDB hmm annotation document for testing."""
    return {
        "_id": hmm_id,
        "cluster": cluster,
        "count": 21,
        "length": 356,
        "mean_entropy": 0.52,
        "total_entropy": 184.3,
        "hidden": hidden,
        "names": ["Capsid protein", "Coat protein"],
        "families": {"Geminiviridae": 19},
        "genera": {"Begomovirus": 17},
        "entries": [
            {
                "accession": "NP_040311.1",
                "gi": "9626020",
                "name": "AC1",
                "organism": "Tomato golden mosaic virus",
            },
        ],
    }


@pytest.mark.usefixtures("apply_table")
class TestUpgrade:
    async def test_field_fidelity(self, ctx: MigrationContext):
        """Every field maps straight across and the ``_id`` becomes ``legacy_id``."""
        document = make_hmm_document("hmm_1", cluster=2, hidden=True)

        await ctx.mongo.hmm.insert_one(document)

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT id, legacy_id, cluster, count, length, mean_entropy, "
                        "total_entropy, hidden, names, families, genera, entries "
                        "FROM hmms WHERE legacy_id = 'hmm_1'",
                    ),
                )
            ).one()

        assert isinstance(row.id, int)
        assert row.legacy_id == "hmm_1"
        assert row.cluster == 2
        assert row.count == 21
        assert row.length == 356
        assert row.mean_entropy == 0.52
        assert row.total_entropy == 184.3
        assert row.hidden is True
        assert row.names == document["names"]
        assert row.families == document["families"]
        assert row.genera == document["genera"]
        assert row.entries == document["entries"]

    async def test_missing_hidden_defaults_false(self, ctx: MigrationContext):
        """A document predating the ``hidden`` field is stored as ``False``."""
        document = make_hmm_document("hmm_1")
        del document["hidden"]

        await ctx.mongo.hmm.insert_one(document)

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text("SELECT hidden FROM hmms WHERE legacy_id = 'hmm_1'"),
                )
            ).scalar_one()

        assert stored is False

    async def test_backfills_every_document(self, ctx: MigrationContext):
        """All documents in the collection are copied into Postgres."""
        await ctx.mongo.hmm.insert_many(
            [make_hmm_document(f"hmm_{i}", cluster=i) for i in range(5)],
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (
                    await session.execute(
                        text("SELECT legacy_id FROM hmms ORDER BY legacy_id"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == [f"hmm_{i}" for i in range(5)]

    async def test_idempotent_rerun(self, ctx: MigrationContext):
        """Re-running inserts no duplicates and adds documents created in between."""
        await ctx.mongo.hmm.insert_one(make_hmm_document("hmm_1"))

        await upgrade(ctx)

        await ctx.mongo.hmm.insert_one(make_hmm_document("hmm_2"))

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            rows = (
                (
                    await session.execute(
                        text("SELECT legacy_id FROM hmms ORDER BY legacy_id"),
                    )
                )
                .scalars()
                .all()
            )

        assert rows == ["hmm_1", "hmm_2"]

    async def test_empty_collection_is_noop(self, ctx: MigrationContext):
        """An empty collection leaves the table empty."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM hmms"))
            ).scalar_one()

        assert count == 0
