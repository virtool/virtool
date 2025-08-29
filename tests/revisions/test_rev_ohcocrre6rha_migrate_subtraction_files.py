import gzip
import shutil
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from assets.revisions.rev_ohcocrre6rha_migrate_subtraction_files import (
    ensure_subtraction_folder_name,
    upgrade,
)
from virtool.migration import MigrationContext
from virtool.subtractions.pg import SQLSubtractionFile


def parse_fasta(file_path: Path):
    """Parse a FASTA file and yield (sequence_id, sequence) tuples."""
    with gzip.open(file_path, "rt") as f:
        current_id = None
        current_seq = []
        for line in f:
            line = line.strip()
            if line.startswith(">"):
                if current_id:
                    yield current_id, "".join(current_seq)
                current_id = line[1:].split()[0]
                current_seq = []
            else:
                current_seq.append(line)
        if current_id:
            yield current_id, "".join(current_seq)


@pytest.mark.timeout(60)
async def test_upgrade(
    ctx: MigrationContext,
    example_path: Path,
    snapshot: SnapshotAssertion,
):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLSubtractionFile.metadata.create_all)
        await conn.commit()

    subtraction_path = ctx.data_path / "subtractions" / "foo"
    subtraction_path.mkdir(parents=True)

    example_subtraction_path = example_path / "subtractions" / "arabidopsis_thaliana"

    for path in example_subtraction_path.iterdir():
        if path.name != "subtraction.fa.gz":
            shutil.copy(
                path,
                subtraction_path / path.name,
            )

    assert {p.name for p in subtraction_path.iterdir()} == {
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    }

    await ctx.mongo.subtraction.insert_one(
        {
            "_id": "foo",
            "name": "Foo",
            "deleted": False,
        },
    )

    await upgrade(ctx)

    assert {p.name for p in subtraction_path.iterdir()} == {
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.fa.gz",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    }

    async with AsyncSession(ctx.pg) as session:
        assert (
            await session.execute(select(SQLSubtractionFile))
        ).scalars().all() == snapshot(name="pg")

    expected_fasta = dict(
        parse_fasta(
            Path("assets/example/subtractions/arabidopsis_thaliana/subtraction.fa.gz")
        )
    )

    # Stream through generated FASTA and compare one sequence at a time
    for seq_id, sequence in parse_fasta(subtraction_path / "subtraction.fa.gz"):
        assert seq_id in expected_fasta, f"Unexpected sequence ID: {seq_id}"
        assert expected_fasta[seq_id] == sequence, f"Sequence mismatch for {seq_id}"
        expected_fasta.pop(seq_id)

    # Ensure no expected sequences were missed
    assert not expected_fasta, f"Missing sequences: {list(expected_fasta.keys())}"


class TestEnsureSubtractionFileName:
    @staticmethod
    async def test_ensure_subtraction_file_name(
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
    ):
        subtraction_path = ctx.data_path / "subtractions" / "foo_bar"
        subtraction_path.mkdir(parents=True)
        (subtraction_path / "foo.txt").write_text("foo")

        await ensure_subtraction_folder_name(ctx, "Foo Bar")

        updated_path = ctx.data_path / "subtractions" / "Foo_Bar"
        assert updated_path.is_dir()
        assert [file.name for file in updated_path.iterdir()] == snapshot

    @staticmethod
    async def test_ensure_subtraction_file_name_has_conflict(ctx):
        subtraction_path = ctx.data_path / "subtractions" / "foo"
        subtraction_path.mkdir(parents=True)

        await ctx.mongo.subtraction.insert_one(
            {
                "_id": "foo",
                "name": "foo",
                "deleted": False,
            },
        )
        with pytest.raises(ValueError):
            await ensure_subtraction_folder_name(ctx, "Foo")

    @staticmethod
    async def test_ensure_subtraction_file_name_no_file(ctx):
        with pytest.raises(FileNotFoundError):
            await ensure_subtraction_folder_name(ctx, "Foo")
