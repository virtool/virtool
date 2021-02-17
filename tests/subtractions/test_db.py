import os

import virtool.subtractions.db
import virtool.tasks.db


async def test_add_subtraction_files_task(tmpdir, spawn_client, dbi):
    client = await spawn_client(authorize=True)

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")
    test_dir.join("subtraction.fa.gz").write("FASTA file")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    await client.db.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "deleted": False
    })

    client.app["settings"]["data_path"] = str(tmpdir)

    add_files_task = await virtool.tasks.db.register(dbi, "add_subtraction_files")
    add_subtraction_files_task = virtool.subtractions.db.AddSubtractionFilesTask(client.app, add_files_task["id"])
    await add_subtraction_files_task.run()

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
