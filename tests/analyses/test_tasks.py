import os

from sqlalchemy import select

from virtool.analyses.models import AnalysisFile
from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.tasks.models import Task


async def test_store_nuvs_files_task(tmp_path, spawn_client, dbi, pg, pg_session, static_time):
    client = await spawn_client(authorize=True)

    test_dir = tmp_path / "samples" / "foo" / "analysis" / "bar"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_dir.joinpath("assembly.fa").write_text("FASTA file")
    test_dir.joinpath("hmm.tsv").write_text("HMM file")
    test_dir.joinpath("unmapped_otus.fq").write_text("FASTQ file")

    client.app["settings"]["data_path"] = tmp_path

    await dbi.analyses.insert_one({
        "_id": "bar",
        "workflow": "nuvs",
        "sample": {
            "id": "foo"
        }
    })

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="store_nuvs_files",
        type="store_nuvs_file_task",
        created_at=static_time.datetime
    )
    async with pg_session as session:
        session.add(task)
        await session.commit()

    store_nuvs_task = StoreNuvsFilesTask(client.app, 1)
    await store_nuvs_task.run()

    async with pg_session as session:
        files = (await session.execute(select(AnalysisFile))).scalars().all()
        rows = [file.to_dict() for file in files]

    assert rows == [
        {
            'id': 1,
            'analysis': 'bar',
            'description': None,
            'format': 'fasta',
            'name': 'assembly.fa.gz',
            'name_on_disk': '1-assembly.fa.gz',
            'size': (tmp_path / "analyses" / "bar" / "assembly.fa.gz").stat().st_size,
            'uploaded_at': None
        },
        {
            'id': 2,
            'analysis': 'bar',
            'description': None,
            'format': 'tsv',
            'name': 'hmm.tsv',
            'name_on_disk': '2-hmm.tsv',
            'size': (tmp_path / "analyses" / "bar" / "hmm.tsv").stat().st_size,
            'uploaded_at': None
        },
        {
            'id': 3,
            'analysis': 'bar',
            'description': None,
            'format': 'fastq',
            'name': 'unmapped_otus.fq.gz',
            'name_on_disk': '3-unmapped_otus.fq.gz',
            'size': (tmp_path / "analyses" / "bar" / "unmapped_otus.fq.gz").stat().st_size,
            'uploaded_at': None
        }
    ]
    assert set(os.listdir(tmp_path / "analyses" / "bar")) == {"assembly.fa.gz", "hmm.tsv", "unmapped_otus.fq.gz"}
    assert not (tmp_path / "samples" / "foo" / "analysis" / "bar").is_dir()