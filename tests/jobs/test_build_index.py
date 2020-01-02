import os
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
def mock_job(tmpdir, mocker, request, dbs, test_db_connection_string, test_db_name):
    tmpdir.mkdir("references").mkdir("foo")

    settings = {
        "data_path": str(tmpdir),
        "db_name": test_db_name
    }

    dbs.references.insert_one({
        "_id": "foo",
        "data_type": "genome"
    })

    dbs.jobs.insert_one({
        "_id": "foobar",
        "task": "build_index",
        "args": {
            "index_id": "bar",
            "ref_id": "foo"
        },
        "proc": 2,
        "mem": 8
    })

    queue = mocker.Mock()

    job = virtool.jobs.build_index.Job(
        test_db_connection_string,
        test_db_name,
        settings,
        "foobar",
        queue
    )

    job.init_db()

    return job


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
def test_check_db(dbs, data_type, tmpdir, mock_job):
    """
    Test that method provides the required parameters and that `data_type` is derived correctly.

    """
    dbs.references.update_one({"_id": "foo"}, {
        "$set": {
            "data_type": data_type
        }
    })

    mock_job.check_db()

    assert mock_job.params == {
        "data_type": data_type,
        "index_id": "bar",
        "index_path": os.path.join(str(tmpdir), "references/foo/bar"),
        "ref_id": "foo",
        "reference_path": os.path.join(str(tmpdir), "references/foo")
    }


def test_mk_index_dir(dbs, tmpdir, mock_job):
    """
    Test that index dir is created successfully.

    """
    mock_job.check_db()
    assert not os.path.exists(mock_job.params["index_path"])

    # Path exists after `mk_index_dir` runs.
    mock_job.mk_index_dir()
    assert os.path.exists(mock_job.params["index_path"])


def test_get_patched_otus(mocker, dbs):
    m = mocker.patch("virtool.db.sync.patch_otu_to_version", return_value=(None, {"_id": "foo"}, None))

    manifest = {
        "foo": 2,
        "bar": 10,
        "baz": 4
    }

    patched_otus = virtool.jobs.build_index.get_patched_otus(dbs, manifest)

    assert isinstance(patched_otus, types.GeneratorType)

    assert list(patched_otus) == [
        {"_id": "foo"},
        {"_id": "foo"},
        {"_id": "foo"}
    ]

    m.assert_has_calls([
        mocker.call(dbs, "foo", 2),
        mocker.call(dbs, "bar", 10),
        mocker.call(dbs, "baz", 4)
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


def test_remove_unused_index_files(tmpdir):
    """
    Test that all and only non-active indexes are removed.

    """
    active_index_ids = [
        "foo",
        "baz"
    ]

    index_ids = [
        "foo",
        "bar",
        "baz",
        "boo"
    ]

    for index_id in index_ids:
        tmpdir.mkdir(index_id).join("test.fa").write("hello world")

    for index_id in index_ids:
        assert os.listdir(os.path.join(str(tmpdir), index_id)) == ["test.fa"]

    virtool.jobs.build_index.remove_unused_index_files(
        str(tmpdir),
        active_index_ids
    )

    assert set(os.listdir(str(tmpdir))) == set(active_index_ids)

    for index_id in active_index_ids:
        assert os.listdir(os.path.join(str(tmpdir), index_id)) == ["test.fa"]


def test_write_sequences_to_file(snapshot, tmpdir):
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

    virtool.jobs.build_index.write_sequences_to_file(path, sequences)

    with open(path, "r") as f:
        snapshot.assert_match(f.read())
