from sqlalchemy import select

import virtool.subtractions.db
from virtool.subtractions.db import unlink_default_subtractions
from virtool.subtractions.models import SubtractionFile

from virtool.tasks.models import Task


async def test_add_subtraction_files_task(tmpdir, spawn_client, dbi, pg_session,
                                          static_time):
    client = await spawn_client(authorize=True)
    client.app["settings"]["data_path"] = str(tmpdir)

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")
    test_dir.join("subtraction.fa.gz").write("FASTA file")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "deleted": False
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
        created_at=static_time.datetime
    )

    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_files_task = virtool.subtractions.db.AddSubtractionFilesTask(client.app, 1)

    await add_files_task.run()

    rows = list()
    async with pg_session as session:
        files = (await session.execute(select(SubtractionFile))).scalars().all()
        for file in files:
            rows.append(file.to_dict())

    assert rows == [
        {
            'id': 1,
            'name': 'subtraction.1.bt2',
            'subtraction': 'foo',
            'type': 'bowtie2',
            'size': 12
        },
        {
            'id': 2,
            'name': 'subtraction.fa.gz',
            'subtraction': 'foo',
            'type': 'fasta',
            'size': 10
        }
    ]


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

    result = await virtool.subtractions.db.attach_subtractions(dbi, document)

    assert result == {
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


async def test_get_linked_samples(dbi):
    await dbi.samples.insert_many([
        {"_id": "foo", "name": "Foo", "subtractions": ["1", "5", "3"]},
        {"_id": "bar", "name": "Bar", "subtractions": ["2", "5", "8"]},
        {"_id": "baz", "name": "Baz", "subtractions": ["2"]}
    ])

    samples = await virtool.subtractions.db.get_linked_samples(dbi, "5")

    assert samples == [
        {
            "id": "foo",
            "name": "Foo"
        },
        {
            "id": "bar",
            "name": "Bar"
        }
    ]


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


async def test_create(dbi):
    user_id = "test"
    filename = "subtraction.fa.gz"

    document = await virtool.subtractions.db.create(dbi, user_id, filename, "Foo", "foo", 1, subtraction_id="abc")

    assert document == {
        "_id": "abc",
        "name": "Foo",
        "nickname": "foo",
        "deleted": False,
        "ready": False,
        "is_host": True,
        "file": {
            "id": 1,
            "name": "subtraction.fa.gz"
        },
        "user": {
            "id": "test"
        }
    }


async def test_finalize(dbi, pg):
    await dbi.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
    })

    gc = {
        "a": 0.319,
        "t": 0.319,
        "g": 0.18,
        "c": 0.18,
        "n": 0.002
    }

    document = await virtool.subtractions.db.finalize(dbi, pg, "foo", gc)
    assert document == {
        "_id": "foo",
        "name": "Foo",
        "gc": {
            "a": 0.319,
            "t": 0.319,
            "g": 0.18,
            "c": 0.18,
            "n": 0.002
        },
        "ready": True
    }
