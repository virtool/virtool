from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_jlq24f8q12pk_migrate_nuvs_files import upgrade
from virtool.analyses.models import SQLAnalysisFile


async def test_upgrade(ctx, snapshot):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLAnalysisFile.metadata.create_all)
        await conn.commit()

    analysis_path = ctx.data_path / "samples" / "foo" / "analysis" / "bar"
    analysis_path.mkdir(parents=True, exist_ok=True)
    analysis_path.joinpath("assembly.fa").write_text("FASTA file")
    analysis_path.joinpath("hmm.tsv").write_text("HMM file")
    analysis_path.joinpath("unmapped_otus.fq").write_text("FASTQ file")

    await ctx.mongo.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}},
    )

    await upgrade(ctx)

    assert {path.name for path in (ctx.data_path / "analyses" / "bar").iterdir()} == {
        "assembly.fa.gz",
        "hmm.tsv",
        "unmapped_otus.fq.gz",
    }

    async with AsyncSession(ctx.pg) as session:
        assert (
            await session.execute(select(SQLAnalysisFile))
        ).scalars().all() == snapshot
