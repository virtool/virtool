import os
import pytest
from concurrent.futures import ProcessPoolExecutor

import virtool.errors
import virtool.subtraction


@pytest.fixture
def mock_subtraction():
    return {
        "_id": "Arabidopsis thaliana",
        "count": 3,
        "ready": False,
        "job": {
            "id": None
        },
        "file": {
            "id": "foobar-arabidopsis.fa",
            "name": "arabidopsis.fa"
        },
        "user": {
            "id": "igboyes"
        },
        "gc": {
            "a": 0.149,
            "t": 0.345,
            "g": 0.253,
            "c": 0.241,
            "n": 0.011
        }
    }


@pytest.fixture
def test_create_subtraction(tmpdir, write_mock_fasta, loop, test_motor, test_dispatch):
    tmpdir.mkdir("reference").mkdir("subtraction")
    tmpdir.mkdir("logs").mkdir("jobs")
    tmpdir.mkdir("files")

    write_mock_fasta(os.path.join(str(tmpdir), "files", "foobar-arabidopsis.fa"))

    executor = ProcessPoolExecutor()

    settings = {
        "data_path": str(tmpdir)
    }

    job = virtool.subtraction.CreateSubtraction(
        loop,
        executor,
        test_motor,
        settings,
        test_dispatch,
        "foobar",
        "create_subtraction",
        dict(subtraction_id="Arabidopsis thaliana", file_id="foobar-arabidopsis.fa"),
        1,
        4
    )

    return job


@pytest.fixture
def write_mock_fasta(tmpdir):
    lines = [
        ">foo\n",
        "ATGGACTGGTTCTCTCTCTCTAGGCACTG\n",
        ">bar\n",
        "GGGTCGGCGCGGACATTCGGACTTATTAG\n",
        ">baz\n",
        "TTTCGACTTGACTTCTTNTCTCATGCGAT"
    ]

    def func(path):
        with open(path, "w") as handle:
            for line in lines:
                handle.write(line)

    return func




@pytest.fixture
def mock_fasta(tmpdir, write_mock_fasta):
    fasta_path = os.path.join(str(tmpdir), "test.fa")

    write_mock_fasta(fasta_path)

    return fasta_path

async def test_calculate_gc(mock_fasta):
    assert virtool.subtraction.calculate_fasta_gc(mock_fasta) == ({
        "a": 0.149,
        "t": 0.345,
        "g": 0.253,
        "c": 0.241,
        "n": 0.011
    }, 3)


async def test_mk_subtraction_dir(tmpdir, test_create_subtraction):
    await test_create_subtraction.mk_subtraction_dir()

    path = os.path.join(str(tmpdir), "reference", "subtraction")

    assert os.listdir(path) == ["arabidopsis_thaliana"]


async def test_set_stats(test_motor, mock_subtraction, test_create_subtraction, test_dispatch):

    await test_motor.subtraction.insert_one(mock_subtraction)

    await test_create_subtraction.set_stats()

    mock_subtraction["_id"] = mock_subtraction.pop("_id")

    assert await test_motor.subtraction.find_one() == mock_subtraction

    print(test_dispatch.stub.call_args[0])

    assert test_dispatch.stub.call_args[0]== (
        "subtraction",
        "update",
        {
            "id": "Arabidopsis thaliana",
            "ready": False,
            "file": {
                "name": "arabidopsis.fa",
                "id": "foobar-arabidopsis.fa"
            },
            "job": {
                "id": None
            }
        }
    )


async def test_update_db(test_motor, mock_subtraction, test_create_subtraction, test_dispatch):
    await test_motor.subtraction.insert_one(mock_subtraction)

    await test_create_subtraction.update_db()

    assert await test_motor.subtraction.find_one() == dict(mock_subtraction, ready=True)

    assert test_dispatch.stub.call_args[0] == (
        "subtraction",
        "update",
        {
            "id": "Arabidopsis thaliana",
            "ready": True,
            "file": {
                "name": "arabidopsis.fa",
                "id": "foobar-arabidopsis.fa"
            },
            "job": {
                "id": None
            }
        }
    )


async def test_cleanup(tmpdir, test_motor, test_create_subtraction):
    await test_motor.subtraction.insert_one({
        "_id": "Arabidopsis thaliana"
    })

    path = os.path.join(str(tmpdir), "reference", "subtraction", "arabidopsis_thaliana")

    await test_create_subtraction.mk_subtraction_dir()

    assert os.path.exists(path)

    await test_create_subtraction.cleanup()

    assert not os.path.exists(path)

    assert await test_motor.subtraction.count() == 0
