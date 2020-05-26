import os

import aiohttp.test_utils
import pytest
import types
import virtool.jobs.build_index


@pytest.fixture
def fake_otus():
    return [
        {
            "_id": "foo",
            "isolates": [
                {
                    "id": "foo_1",
                    "default": True,
                    "sequences": [
                        {
                            "_id": "1",
                            "sequence": "AGAGGATAGAGACACA"
                        },
                        {
                            "_id": "2",
                            "sequence": "GGGTAGTCGATCTGGC"
                        }
                    ]
                },
                {
                    "id": "foo_2",
                    "default": False,
                    "sequences": [
                        {
                            "_id": "3",
                            "sequence": "TTTAGAGTTGGATTAC",
                            "default": True
                        },
                        {
                            "_id": "4",
                            "sequence": "AAAGGAGAGAGAAACC",
                            "default": True
                        }
                    ]
                },
            ]
        },
        {
            "_id": "bar",
            "isolates": [
                {
                    "id": "bar_1",
                    "default": True,
                    "sequences": [
                        {
                            "_id": "5",
                            "sequence": "TTTGAGCCACACCCCC"
                        },
                        {
                            "_id": "6",
                            "sequence": "GCCCACCCATTAGAAC"
                        }
                    ]
                }
            ]
        }
    ]


@pytest.fixture
async def mock_job(tmpdir, mocker, request, dbi, test_db_connection_string, test_db_name):
    tmpdir.mkdir("references").mkdir("foo")

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name,
        "proc": 1,
        "mem": 4
    }

    await dbi.references.insert_one({
        "_id": "foo",
        "data_type": "genome"
    })

    await dbi.jobs.insert_one({
        "_id": "foobar",
        "task": "build_index",
        "args": {
            "index_id": "bar",
            "ref_id": "foo"
        },
        "proc": 2,
        "mem": 8
    })

    job = virtool.jobs.build_index.create()

    job.db = dbi
    job.settings = settings
    job.id = "foobar"

    await job._connect_db()
    await job._startup()

    return job


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
async def test_check_db(dbi, data_type, tmpdir, mock_job):
    """
    Test that method provides the required parameters and that `data_type` is derived correctly.

    """
    await dbi.references.update_one({"_id": "foo"}, {
        "$set": {
            "data_type": data_type
        }
    })

    await virtool.jobs.build_index.check_db(mock_job)

    assert mock_job.params == {
        "data_type": data_type,
        "index_id": "bar",
        "index_path": os.path.join(str(tmpdir), "references/foo/bar"),
        "ref_id": "foo",
        "reference_path": os.path.join(str(tmpdir), "references/foo"),
        "temp_index_path": os.path.join(mock_job.temp_dir.name, "bar")
    }


async def test_mk_index_dir(tmpdir, mock_job):
    """
    Test that index dir is created successfully.

    """
    # Path exists after `mk_index_dir` runs.
    await virtool.jobs.build_index.mk_index_dir(mock_job)
    assert os.path.exists(mock_job.params["temp_index_path"])


async def test_get_patched_otus(mocker, dbi):
    m = mocker.patch("virtool.history.db.patch_to_version", aiohttp.test_utils.make_mocked_coro((None, {"_id": "foo"}, None)))

    manifest = {
        "foo": 2,
        "bar": 10,
        "baz": 4
    }

    settings = {
        "data_path": "foo"
    }

    patched_otus = await virtool.jobs.build_index.get_patched_otus(
        dbi,
        settings,
        manifest
    )

    assert list(patched_otus) == [
        {"_id": "foo"},
        {"_id": "foo"},
        {"_id": "foo"}
    ]

    app_dict = {
        "db": dbi,
        "settings": settings
    }

    m.assert_has_calls([
        mocker.call(app_dict, "foo", 2),
        mocker.call(app_dict, "bar", 10),
        mocker.call(app_dict, "baz", 4)
    ])


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
def test_get_sequences_from_patched_otus(data_type, mocker, snapshot, dbs, fake_otus):
    sequence_otu_dict = dict()

    sequences = virtool.jobs.build_index.get_sequences_from_patched_otus(
        fake_otus,
        data_type,
        sequence_otu_dict
    )

    assert isinstance(sequences, types.GeneratorType)

    snapshot.assert_match(list(sequences))
    snapshot.assert_match(sequence_otu_dict)


async def test_write_sequences_to_file(snapshot, tmpdir):
    sequences = [
        {
            "_id": "foo",
            "sequence": "ATTGAGAGATAGAGACAC"
        },
        {
            "_id": "bar",
            "sequence": "GGGTACGAGTTTCTATCG"
        },
        {
            "_id": "baz",
            "sequence": "GGCTTCGGACTTTTTTCG"
        }
    ]

    path = os.path.join(str(tmpdir), "output.fa")

    await virtool.jobs.build_index.write_sequences_to_file(path, sequences)

    with open(path, "r") as f:
        snapshot.assert_match(f.read())
