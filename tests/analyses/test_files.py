from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy import select

import virtool.analyses.files
from virtool.analyses.models import AnalysisFile


async def test_create_nuvs_analysis_files(snapshot, tmp_path, pg: AsyncEngine):
    test_dir = tmp_path / "analyses"
    test_dir.mkdir()
    test_dir.joinpath("assembly.fa.gz").write_text("FASTA file")
    test_dir.joinpath("hmm.tsv").write_text("HMM file")

    await virtool.analyses.files.create_nuvs_analysis_files(
        pg, "foo", ["assembly.fa", "hmm.tsv"], test_dir
    )

    async with AsyncSession(pg) as session:
        assert (await session.execute(select(AnalysisFile))).scalars().all() == snapshot
