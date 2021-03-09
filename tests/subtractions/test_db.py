import os

import pytest

import virtool.subtractions.db
import virtool.tasks.db
from virtool.tasks.models import Task


@pytest.mark.parametrize("ignore", [True, False])
async def test_add_subtraction_files_task(ignore, mocker, tmpdir, spawn_client, dbi, pg_session):
    client = await spawn_client(authorize=True)

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")
    test_dir.join("subtraction.fa.gz").write("FASTA file")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "deleted": False
    }

    if ignore:
        subtraction["files"] = [
            {
                'size': 12,
                'name': 'subtraction.1.bt2',
                'type': 'bowtie2'
            },
            {
                'size': 10,
                'name': 'subtraction.fa.gz',
                'type': 'fasta'
            }
        ]

    await client.db.subtraction.insert_one(subtraction)

    client.app["settings"]["data_path"] = str(tmpdir)
    path = os.path.join(tmpdir, "subtractions", "foo")
    m_join_subtraction_path = mocker.patch('virtool.subtractions.utils.join_subtraction_path', return_value=path)

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="rename_index_files",
        type="add_subtraction_files"
    )
    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_files_task = virtool.subtractions.db.AddSubtractionFilesTask(client.app, 1)
    await add_files_task.run()

    if ignore:
        m_join_subtraction_path.assert_not_called()
        return

    document = await dbi.subtraction.find_one("foo")
    assert document == {
        '_id': 'foo',
        'name': 'Foo',
        'nickname': 'Foo Subtraction',
        'deleted': False,
        'files': [
            {
                'size': os.stat(os.path.join(test_dir, "subtraction.1.bt2")).st_size,
                'name': 'subtraction.1.bt2',
                'type': 'bowtie2'
            },
            {
                'size': os.stat(os.path.join(test_dir, "subtraction.fa.gz")).st_size,
                'name': 'subtraction.fa.gz',
                'type': 'fasta'
            }
        ]
    }
