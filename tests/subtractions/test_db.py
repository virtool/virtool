import os

import pytest

import virtool.subtractions.db
from virtool.subtractions.db import unlink_default_subtractions

from virtool.tasks.models import Task


@pytest.mark.parametrize("ignore", [True, False])
async def test_add_subtraction_files_task(ignore, mocker, tmpdir, spawn_client, dbi, pg_session, static_time):
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
        type="add_subtraction_files",
        created_at=static_time.datetime
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


async def test_attach_subtractions(dbi):
    await dbi.subtraction.insert_many([
        {
            "_id": "foo",
            "name": "Foo"
        },
        {
            "_id": "bar",
            "name": "Bar"
        }
    ])

    document = {
        "_id": "foobar",
        "subtractions": ["foo", "bar"]
    }

    await virtool.subtractions.db.attach_subtractions(dbi, document)

    assert document == {
        "_id": "foobar",
        "subtractions": [
            {
                "id": "foo",
                "name": "Foo"
            },
            {
                "id": "bar",
                "name": "Bar"
            }
        ]
    }


async def test_unlink_default_subtractions(dbi):
    await dbi.samples.insert_many([
        {"_id": "foo", "subtractions": ["1", "2", "3"]},
        {"_id": "bar", "subtractions": ["2", "5", "8"]},
        {"_id": "baz", "subtractions": ["2"]}
    ])

    await unlink_default_subtractions(dbi, "2")



    assert await dbi.samples.find().to_list(None) == [
        {"_id": "foo", "subtractions": ["1", "3"]},
        {"_id": "bar", "subtractions": ["5", "8"]},
        {"_id": "baz", "subtractions": []}
    ]