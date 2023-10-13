import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.models import SQLAnalysisFile
from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.tasks.models import SQLTask
from virtool.utils import get_temp_dir


async def test_store_nuvs_files_task(
    config, data_layer, mongo, pg: AsyncEngine, snapshot, static_time, tmp_path
):
    test_dir = tmp_path / "samples" / "foo" / "analysis" / "bar"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_dir.joinpath("assembly.fa").write_text("FASTA file")
    test_dir.joinpath("hmm.tsv").write_text("HMM file")
    test_dir.joinpath("unmapped_otus.fq").write_text("FASTQ file")

    await mongo.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}}
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="store_nuvs_files",
                type="store_nuvs_file_task",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = StoreNuvsFilesTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    async with AsyncSession(pg) as session:
        task = await session.scalar(select(SQLTask).where(SQLTask.id == 1))
        assert task.error is None

    assert set(os.listdir(tmp_path / "analyses" / "bar")) == {
        "assembly.fa.gz",
        "hmm.tsv",
        "unmapped_otus.fq.gz",
    }

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLAnalysisFile))
        ).scalars().all() == snapshot

    assert not (tmp_path / "samples" / "foo" / "analysis" / "bar").is_dir()
