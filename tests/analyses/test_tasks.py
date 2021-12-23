import os

from sqlalchemy import select
from virtool.analyses.models import AnalysisFile
from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.tasks.models import Task


async def test_store_nuvs_files_task(
    snapshot, tmp_path, spawn_client, dbi, pg, pg_session, static_time
):
    client = await spawn_client(authorize=True)

    test_dir = tmp_path / "samples" / "foo" / "analysis" / "bar"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_dir.joinpath("assembly.fa").write_text("FASTA file")
    test_dir.joinpath("hmm.tsv").write_text("HMM file")
    test_dir.joinpath("unmapped_otus.fq").write_text("FASTQ file")

    client.app["config"].data_path = tmp_path

    await dbi.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}}
    )

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="store_nuvs_files",
        type="store_nuvs_file_task",
        created_at=static_time.datetime,
    )
    async with pg_session as session:
        session.add(task)
        await session.commit()

    store_nuvs_task = StoreNuvsFilesTask(client.app, 1)
    await store_nuvs_task.run()

    async with pg_session as session:
        assert (await session.execute(select(AnalysisFile))).scalars().all() == snapshot

    assert set(os.listdir(tmp_path / "analyses" / "bar")) == {
        "assembly.fa.gz",
        "hmm.tsv",
        "unmapped_otus.fq.gz",
    }

    assert not (tmp_path / "samples" / "foo" / "analysis" / "bar").is_dir()
