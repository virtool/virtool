from sqlalchemy import select
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.tasks.models import Task


async def test_add_subtraction_files_task(
    snapshot,
    tmp_path,
    spawn_client,
    dbi,
    pg_session,
    static_time,
):
    client = await spawn_client(authorize=True)
    client.app["config"].data_path = tmp_path

    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "deleted": False,
    }

    await client.db.subtraction.insert_one(subtraction)

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="rename_index_files",
        type="add_subtraction_files",
        created_at=static_time.datetime,
    )

    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_files_task = AddSubtractionFilesTask(client.app, 1)

    await add_files_task.run()

    async with pg_session as session:
        assert (
            await session.execute(select(SubtractionFile))
        ).scalars().all() == snapshot
