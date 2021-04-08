import gzip
import os
import shutil
import sys
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.samples.db
import virtool.samples.utils
import virtool.uploads.db
import virtool.pg.utils
from virtool.labels.models import Label
from virtool.samples.models import SampleReads
from virtool.tasks.models import Task
from virtool.uploads.models import Upload

FASTQ_PATH = Path(sys.path[0]) / "tests/test_files/test.fq"


class TestCalculateWorkflowTags:

    @pytest.mark.parametrize("path_ready,path_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
    @pytest.mark.parametrize("alg1,alg2", [
        ("bowtie", "bowtie"),
        ("bowtie", "barracuda"),
        ("barracuda", "bowtie"),
        ("barracuda", "barracuda")
    ])
    @pytest.mark.parametrize("nuvs_ready,nuvs_tag", [
        ([False, False], "ip"),
        ([True, False], True),
        ([False, True], True),
        ([True, True], True)
    ])
    def test(self, path_ready, alg1, alg2, path_tag, nuvs_ready, nuvs_tag):
        """
        Test that the function returns the correct update dict for every combination of pathoscope
        and nuvs ready states.

        """
        index = 0

        path_ready_1, path_ready_2 = path_ready
        nuvs_ready_1, nuvs_ready_2 = nuvs_ready

        documents = [
            {
                "_id": index,
                "ready": path_ready_1,
                "workflow": "pathoscope_{}".format(alg1)
            },
            {
                "_id": index,
                "ready": path_ready_2,
                "workflow": "pathoscope_{}".format(alg2)
            },
            {
                "_id": index,
                "ready": nuvs_ready_1,
                "workflow": "nuvs"
            },
            {
                "_id": index,
                "ready": nuvs_ready_2,
                "workflow": "nuvs"
            }
        ]

        tags = virtool.samples.utils.calculate_workflow_tags(documents)

        assert tags == {
            "pathoscope": path_tag,
            "nuvs": nuvs_tag
        }


class TestRecalculateWorkflowTags:

    async def test(self, mocker, dbi):
        await dbi.samples.insert_one({
            "_id": "test",
            "pathoscope": False,
            "nuvs": False
        })

        analysis_documents = [
            {
                "_id": "test_1",
                "workflow": "pathoscope_bowtie",
                "ready": "ip",
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_2",
                "workflow": "pathoscope_bowtie",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            },
            {
                "_id": "test_3",
                "workflow": "nuvs",
                "ready": True,
                "sample": {
                    "id": "test"
                }
            }
        ]

        await dbi.analyses.insert_many(analysis_documents + [
            {
                "_id": "test_4",
                "sample": {
                    "id": "foobar"
                },
                "workflow": "pathoscope_bowtie",
                "ready": True
            }
        ])

        m = mocker.patch("virtool.samples.utils.calculate_workflow_tags", return_value={
            "pathoscope": True,
            "nuvs": "ip"
        })

        await virtool.samples.db.recalculate_workflow_tags(dbi, "test")

        for document in analysis_documents:
            del document["sample"]

        assert m.call_args[0][0] == analysis_documents

        assert await dbi.samples.find_one() == {
            "_id": "test",
            "pathoscope": True,
            "nuvs": "ip"
        }


class TestGetSampleOwner:

    async def test(self, dbi):
        """
        Test that the correct owner id is returned given a sample id.

        """
        await dbi.samples.insert_many([
            {
                "_id": "test",
                "user": {
                    "id": "foobar"
                }
            },
            {
                "_id": "baz",
                "user": {
                    "id": "fred"
                }
            },
        ])

        assert await virtool.samples.db.get_sample_owner(dbi, "test") == "foobar"

    async def test_none(self, dbi):
        """
        Test that ``None`` is returned if the sample id does not exist.

        """
        assert await virtool.samples.db.get_sample_owner(dbi, "foobar") is None


class TestRemoveSamples:

    @pytest.mark.parametrize("id_list,ls,samples,analyses", [
        (
                ["test_1"],
                ["test_2", "test_3"],
                [{"_id": "test_2"}, {"_id": "test_3"}],
                [
                    {"_id": "a_3", "sample": {"id": "test_2"}},
                    {"_id": "a_4", "sample": {"id": "test_2"}},
                    {"_id": "a_5", "sample": {"id": "test_2"}},
                    {"_id": "a_6", "sample": {"id": "test_3"}},
                    {"_id": "a_7", "sample": {"id": "test_3"}},
                    {"_id": "a_8", "sample": {"id": "test_3"}},
                    {"_id": "a_9", "sample": {"id": "test_3"}}
                ]
        ),
        (
                ["test_1", "test_2"],
                ["test_3"],
                [{"_id": "test_3"}],
                [
                    {"_id": "a_6", "sample": {"id": "test_3"}},
                    {"_id": "a_7", "sample": {"id": "test_3"}},
                    {"_id": "a_8", "sample": {"id": "test_3"}},
                    {"_id": "a_9", "sample": {"id": "test_3"}}
                ]
        )
    ])
    async def test(self, id_list, ls, samples, analyses, tmpdir, dbi):
        """
        Test that the function can remove one or more samples, their analysis documents, and files.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")
        sample_2_file = samples_dir.mkdir("test_2").join("test.txt")
        sample_3_file = samples_dir.mkdir("test_3").join("test.txt")

        for handle in [sample_1_file, sample_2_file, sample_3_file]:
            handle.write("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"},
            {"_id": "test_3"}
        ])

        await dbi.analyses.insert_many([
            {"_id": "a_1", "sample": {"id": "test_1"}},
            {"_id": "a_2", "sample": {"id": "test_1"}},
            {"_id": "a_3", "sample": {"id": "test_2"}},
            {"_id": "a_4", "sample": {"id": "test_2"}},
            {"_id": "a_5", "sample": {"id": "test_2"}},
            {"_id": "a_6", "sample": {"id": "test_3"}},
            {"_id": "a_7", "sample": {"id": "test_3"}},
            {"_id": "a_8", "sample": {"id": "test_3"}},
            {"_id": "a_9", "sample": {"id": "test_3"}}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, id_list)

        assert set(ls) == set(os.listdir(str(samples_dir)))

        assert await dbi.samples.find().to_list(None) == samples
        assert await dbi.analyses.find().to_list(None) == analyses

    async def test_not_list(self, dbi):
        """
        Test that a custom ``TypeError`` is raised if a non-list variable is passed as ``id_list``.

        """
        settings = {
            "data_path"
        }

        with pytest.raises(TypeError) as excinfo:
            await virtool.samples.db.remove_samples(dbi, settings, "foobar")

        assert "id_list must be a list" in str(excinfo.value)

    async def test_file_not_found(self, tmpdir, dbi):
        """
        Test that the function does not fail when a sample folder is missing.

        """
        samples_dir = tmpdir.mkdir("samples")

        sample_1_file = samples_dir.mkdir("test_1").join("test.txt")

        sample_1_file.write("hello world")

        await dbi.samples.insert_many([
            {"_id": "test_1"},
            {"_id": "test_2"}
        ])

        settings = {
            "data_path": str(tmpdir)
        }

        await virtool.samples.db.remove_samples(dbi, settings, ["test_1", "test_2"])

        assert os.listdir(str(samples_dir)) == []

        assert not await dbi.samples.count_documents({})


async def test_attach_labels(spawn_client, pg_session, pg: AsyncEngine):
    label_1 = Label(id=1, name="Bug", color="#a83432", description="This is a bug")
    label_2 = Label(id=2, name="Question", color="#03fc20", description="This is a question")

    async with pg_session as session:
        session.add_all([label_1, label_2])
        await session.commit()

    document = {
        "id": "foo",
        "name": "Foo",
        "labels": [1, 2]
    }

    result = await virtool.samples.db.attach_labels(pg, document)

    assert result == {
        "id": "foo",
        "name": "Foo",
        "labels": [
            {"id": 1, "name": "Bug", "color": "#a83432", "description": "This is a bug"},
            {"id": 2, "name": "Question", "color": "#03fc20", "description": "This is a question"}
        ]
    }


async def test_create_sample(dbi, mocker, snapshot, static_time, spawn_client):
    """
    Test that a sample can be properly created.

    """
    client = await spawn_client(authorize=True, administrator=True)

    mocker.patch("virtool.db.utils.get_new_id", return_value="a2oj3gfd")

    document = await virtool.samples.db.create_sample(dbi, "foo", "", "", "", "", "", [], [], "test", [], "bob", client.app["settings"])

    snapshot.assert_match(document)


class TestCheckIsLegacy:

    @pytest.mark.parametrize("is_legacy,files", [
        (False, [{"raw": True}]),
        (True, [{"raw": False}]),
        (False, [{"raw": True}, {"raw": False}]),
        (True, [{"raw": False}, {"raw": False}]),
    ])
    def test_raw(self, is_legacy, files):
        """
        Test that checks check ``raw`` files field correctly.

        """
        files[0]["name"] = "reads_1.fastq"

        try:
            files[1]["name"] = "reads_2.fastq"
        except IndexError:
            pass

        sample = {
            "_id": "foo",
            "paired": len(files) == 2,
            "files": files
        }

        assert virtool.samples.db.check_is_legacy(sample) is is_legacy

    @pytest.mark.parametrize("paired", [True, False])
    def test_names(self, paired):
        """
        Test that checks fail when names are not as expected.

        """
        files = [{
            "name": "reads.fastq",
            "raw": False
        }]

        if paired:
            files.append({
                "name": "reads_two.fastq",
                "raw": False
            })

        sample = {
            "_id": "foo",
            "files": files,
            "paired": paired
        }

        assert virtool.samples.db.check_is_legacy(sample) is False


async def test_update_is_compressed(dbi):
    """
    Test that samples with both files gzipped are flagged with ``is_compressed``.

    """
    samples = [
        {
            "_id": "foo",
            "files": [
                {"name": "reads_1.fq.gz"},
                {"name": "reads_2.fq.gz"},
            ]
        },
        {
            "_id": "baz",
            "files": [
                {"name": "reads_1.fastq"}
            ]
        },
        {
            "_id": "bar",
            "files": [
                {"name": "reads_1.fq.gz"}
            ]
        }
    ]

    await dbi.samples.insert_many(samples)

    for sample in samples:
        await virtool.samples.db.update_is_compressed(dbi, sample)

    assert await dbi.samples.find().to_list(None) == [
        {
            "_id": "foo",
            "is_compressed": True,
            "files": [
                {"name": "reads_1.fq.gz"},
                {"name": "reads_2.fq.gz"},
            ]
        },
        {
            "_id": "baz",
            "files": [
                {"name": "reads_1.fastq"}
            ]
        },
        {
            "_id": "bar",
            "is_compressed": True,
            "files": [
                {"name": "reads_1.fq.gz"}
            ]
        }
    ]


@pytest.mark.parametrize("paired", [True, False])
async def test_compress_sample_reads(paired, mocker, dbi, snapshot, tmpdir):
    m_update_is_compressed = mocker.patch(
        "virtool.samples.db.update_is_compressed",
        make_mocked_coro()
    )

    async def run_in_thread(func, *args):
        return func(*args)

    sample_dir = tmpdir.mkdir("samples").mkdir("foo")

    shutil.copy(FASTQ_PATH, sample_dir / "reads_1.fastq")

    if paired:
        shutil.copy(FASTQ_PATH, sample_dir / "reads_2.fastq")

    app_dict = {
        "db": dbi,
        "run_in_thread": run_in_thread,
        "settings": {
            "data_path": str(tmpdir)
        }
    }

    sample_id = "foo"

    file = {
        "name": "reads_1.fastq",
        "download_url": f"/download/samples/{sample_id}/reads_1.fastq",
        "size": 3750821789,
        "raw": False,
        "from": {
            "id": "M_S11_R1_001.fastq",
            "name": "M_S11_R1_001.fastq",
            "size": 3750821789
        }
    }

    files = [file]

    if paired:
        files.append({
            **file,
            "name": "reads_2.fastq",
            "download_url": f"/download/samples/{sample_id}/reads_2.fastq"
        })

    sample = {
        "_id": sample_id,
        "files": files,
        "paired": paired
    }

    await dbi.samples.insert_one(sample)

    await virtool.samples.db.compress_sample_reads(app_dict, sample)

    expected_listdir = ["reads_1.fq.gz", "reads_2.fq.gz"] if paired else ["reads_1.fq.gz"]

    assert sorted(os.listdir(sample_dir)) == expected_listdir

    with open(FASTQ_PATH, "r") as f:
        expected_content = f.read()

    with gzip.open(sample_dir / "reads_1.fq.gz", "rt") as f:
        assert expected_content == f.read()

    if paired:
        with gzip.open(sample_dir / "reads_2.fq.gz", "rt") as f:
            assert expected_content == f.read()

    snapshot.assert_match(await dbi.samples.find_one())

    m_update_is_compressed.assert_called_with(app_dict["db"], sample)


async def test_compress_samples_task(mocker, dbi, pg: AsyncEngine, pg_session, static_time):
    """
    Ensure `compress_reads` is called correctly given a samples collection.

    """
    app_dict = {
        "db": dbi,
        "pg": pg,
        "run_in_thread": make_mocked_coro(),
        "settings": dict()
    }

    await dbi.samples.insert_many([
        {
            "_id": "foo",
            "is_legacy": True
        },
        {
            "_id": "fab",
            "is_legacy": False
        },
        {
            "_id": "bar",
            "is_legacy": True
        }
    ])

    async with pg_session as session:
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
        session.add(task)
        await session.commit()

    calls = list()

    async def compress_reads(app, sample):
        calls.append((app, sample))

        # Set is_compressed on the sample as would be expected after a successful compression
        await app["db"].samples.update_one({"_id": sample["_id"]}, {
            "$set": {
                "is_compressed": True
            }
        })

    mocker.patch("virtool.samples.db.compress_sample_reads", compress_reads)

    task = virtool.samples.db.CompressSamplesTask(app_dict, 1)

    await task.run()

    assert calls == ([
        (app_dict, {
            "_id": "foo",
            "is_legacy": True
        }),
        (app_dict, {
            "_id": "bar",
            "is_legacy": True
        })
    ])


@pytest.mark.parametrize("legacy", [True, False])
@pytest.mark.parametrize("compressed", [True, False])
@pytest.mark.parametrize("paired", [True, False])
async def test_move_sample_files_task(legacy, compressed, paired, dbi, pg, pg_session, snapshot, static_time):
    app_dict = {
        "db": dbi,
        "pg": pg,
        "run_in_thread": make_mocked_coro(),
        "settings": dict()
    }

    sample = {
        "_id": "foo",
        "is_legacy": legacy,
        "is_compressed": compressed,
        "files": [
            {
                "download_url": "/download/samples/oictwh/reads_1.fq.gz",
                "name": "reads_1.fq.gz",
                "raw": True,
                "size": 213889231,
                "from": {
                    "id": "vorbsrmz-17TFP120_S21_R1_001.fastq.gz",
                    "name": "vorbsrmz-17TFP120_S21_R1_001.fastq.gz",
                    "size": 239801249712,
                    "uploaded_at": None,
                },
            }
        ],
    }

    if paired:
        sample["files"].append(
            {
                "download_url": "/download/samples/oictwh/reads_2.fq.gz",
                "name": "reads_2.fq.gz",
                "raw": True,
                "size": 213889231,
                "from": {
                    "id": "vorbsrmz-17TFP120_S21_R1_002.fastq.gz",
                    "name": "vorbsrmz-17TFP120_S21_R1_002.fastq.gz",
                    "size": 239801249712,
                    "uploaded_at": None,
                },
            }
        )

    await dbi.samples.insert_one(sample)

    async with pg_session as session:
        task = Task(
            id=1,
            complete=False,
            context={},
            count=0,
            progress=0,
            step="move_sample_files",
            type="migrate_files",
            created_at=static_time.datetime
        )

        session.add(task)
        await session.commit()

    task = virtool.samples.db.MoveSampleFilesTask(app_dict, 1)

    await task.run()

    document = await dbi.samples.find_one({"_id": "foo"})

    snapshot.assert_match(document)

    if not legacy or (legacy and compressed):
        async with pg_session as session:
            sample_reads = (await session.execute(select(SampleReads).filter_by(id=1))).scalar()
            upload = (await session.execute(select(Upload).filter_by(id=1))).scalar()

        assert sample_reads in upload.reads
        assert sample_reads.upload == upload.id


async def test_finalize(tmpdir, dbi, pg, pg_session):
    quality = {
        "count": 10000000,
        "gc": 43
    }

    await dbi.samples.insert_one({
        "_id": "test",
    })

    async with pg_session as session:
        upload = Upload(name="test", name_on_disk="test.fq.gz")
        reads = SampleReads(name="reads_1.fq.gz", name_on_disk="reads_1.fq.gz", sample="test")

        upload.reads.append(reads)
        session.add_all([upload, reads])

        await session.commit()

    m_run_in_thread = make_mocked_coro()

    document = await virtool.samples.db.finalize(dbi, pg, "test", quality, m_run_in_thread, tmpdir)
    assert document == {
        "_id": "test",
        "quality": {
            "count": 10000000,
            "gc": 43
        },
        "ready": True,
        "artifacts": [],
        "reads": [
            {
                "id": 1,
                "sample": "test",
                "name": "reads_1.fq.gz",
                "name_on_disk": "reads_1.fq.gz",
                "size": None,
                "upload": None,
                "uploaded_at": None
            }
        ]
    }
    assert not await virtool.uploads.db.get(pg, 1)
    assert not (await virtool.pg.utils.get_row(pg, 1, SampleReads)).upload
