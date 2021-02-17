import os

import pytest

import virtool.subtractions.db
import virtool.tasks.db


@pytest.mark.parametrize("ignore", [True, False])
async def test_add_subtraction_files_task(ignore, mocker, tmpdir, spawn_client, dbi):
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

    add_files_task = await virtool.tasks.db.register(dbi, "add_subtraction_files")
    add_subtraction_files_task = virtool.subtractions.db.AddSubtractionFilesTask(client.app, add_files_task["id"])
    await add_subtraction_files_task.run()

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
