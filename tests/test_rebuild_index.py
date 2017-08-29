import os
import pytest
import asyncio
from concurrent.futures import ProcessPoolExecutor

import virtool.job
import virtool.virus_index


@pytest.fixture
def test_rebuild_job(tmpdir, loop, test_motor, test_dispatch):
    tmpdir.mkdir("reference").mkdir("viruses")
    tmpdir.mkdir("logs").mkdir("jobs")

    exec = ProcessPoolExecutor()

    settings = {
        "data_path": str(tmpdir)
    }

    job = virtool.virus_index.RebuildIndex(
        loop,
        exec,
        test_motor,
        settings,
        test_dispatch,
        "foobar",
        "rebuild_index",
        dict(index_id="foobar"),
        1,
        4
    )

    return job


async def test_mk_index_dir(tmpdir, test_rebuild_job):
    await test_rebuild_job.mk_index_dir()

    assert os.listdir(os.path.join(str(tmpdir), "reference", "viruses")) == [
        "foobar"
    ]


async def test_write_fasta(mocker, test_rebuild_job):
    m = mocker.stub(name="patch_virus_to_version")

    async def patch_virus_to_version(*args):
        m(*args)
        return None, {
            "isolates": [
                {
                    "default": True,
                    "sequences": [
                        {
                            "_id": "foo",
                            "sequence": "ATAGAGATATAGAGACACACTTACTTATCA"
                        },
                        {
                            "_id": "bar",
                            "sequence": "GGCTTTCTCTATCAGGGAGGACTAGGCTAC"
                        }
                    ]
                },
                {
                    "default": True,
                    "sequences": [
                        {
                            "_id": "baz",
                            "sequence": "ATAGAGATATAGAGACACACTTACTTATCA"
                        },
                        {
                            "_id": "test",
                            "sequence": "GGCTTTCTCTATCAGGGAGGACTAGGCTAC"
                        }
                    ]
                }
            ]
        }, None

    mocker.patch("virtool.virus_history.patch_virus_to_version", patch_virus_to_version)

    test_rebuild_job.task_args["virus_manifest"] = {
        "foobar": 2
    }

    os.mkdir(test_rebuild_job.reference_path)

    await test_rebuild_job.write_fasta()

    with open(os.path.join(test_rebuild_job.reference_path, "ref.fa"), "r") as handle:
        assert handle.read() in [
            ">foo\nATAGAGATATAGAGACACACTTACTTATCA\n>bar\nGGCTTTCTCTATCAGGGAGGACTAGGCTAC\n",
            ">bar\nGGCTTTCTCTATCAGGGAGGACTAGGCTAC\n>foo\nATAGAGATATAGAGACACACTTACTTATCA\n"
        ]


@pytest.mark.parametrize("error", [False, True])
async def test_bowtie_build(error, capsys, tmpdir, test_rebuild_job):
    root_path = os.path.join(str(tmpdir), "reference", "viruses")
    os.mkdir(os.path.join(root_path, "foobar"))

    if not error:
        fasta_path = os.path.join(str(tmpdir), "reference", "viruses", "foobar", "ref.fa")

        with open(fasta_path, "w") as handle:
            handle.write(">test_1\nTACGTATGACTGAGCTACGGGGCTACGACTTACCCTTCACGATCAC")
            handle.write(">test_2\nGGCTTCGGCTGATCACGACTGGACTAGCATCTGACTACGATGCTGA")

    with capsys.disabled():
        if error:
            with pytest.raises(virtool.job.SubprocessError) as err:
                await test_rebuild_job.bowtie_build()

            assert "virtool.job.SubprocessError" in str(err)
            assert "Command failed: bowtie2-build -f" in str(err)
        else:
            await test_rebuild_job.bowtie_build()

    await test_rebuild_job.flush_log()

    log_path = os.path.join(str(tmpdir), "logs", "jobs", test_rebuild_job.id)

    with open(log_path, "r") as handle:
        content = handle.read()

        if error:
            assert "Error: could not open" in content
            assert "Error: Encountered internal Bowtie 2 exception (#1)" in content
        else:
            assert "Building a SMALL index" in content


@pytest.mark.parametrize("in_use", [True, False])
async def test_replace_old(in_use, mocker, tmpdir, test_motor, test_rebuild_job):
    m = mocker.Mock()

    async def run_in_executor(*args):
        return m(*args)

    mocker.patch.object(test_rebuild_job, "run_in_executor", run_in_executor)

    await test_motor.indexes.insert_many([
        {
            "_id": "foobar",
            "version": 2,
            "ready": False,
            "has_files": True
        },
        {
            "_id": "foo",
            "version": 1,
            "ready": True,
            "has_files": True
        },
        {
            "_id": "baz",
            "version": 0,
            "ready": True,
            "has_files": True
        }
    ])

    if in_use:
        await test_motor.analyses.insert_one({
            "_id": "test",
            "ready": False,
            "index": {
                "id": "foo"
            }
        })

    await test_rebuild_job.replace_old()

    assert await test_motor.indexes.find_one("foobar") == {
        "_id": "foobar",
        "version": 2,
        "ready": True,
        "has_files": True
    }

    expected = {"foo", "foobar"} if in_use else {"foobar"}

    assert m.called

    assert m.call_args[0][0:2] == (
        virtool.virus_index.remove_unused_index_files,
        os.path.join(str(tmpdir), "reference", "viruses")
    )

    assert set(m.call_args[0][2]) == expected

    # Make sure that ``has_files`` was set to false for non-active indexes.
    assert set(await test_motor.indexes.find({"has_files": True}).distinct("_id")) == expected


async def test_cleanup(test_motor, test_rebuild_job):
    await test_motor.indexes.insert_one({"_id": "foobar"})

    await test_motor.history.insert_many([
        {
            "_id": "foo",
            "index": {
                "id": "foobar",
                "version": 2
            }
        },
        {
            "_id": "bar",
            "index": {
                "id": "foobar",
                "version": 2
            }
        },
        {
            "_id": "baz",
            "index": {
                "id": "aaa111",
                "version": 1
            }
        }
    ])

    os.mkdir(test_rebuild_job.reference_path)

    with open(os.path.join(test_rebuild_job.reference_path, "test.txt"), "w") as handle:
        handle.write("hello world")

    await test_rebuild_job.cleanup()

    assert not os.path.isdir(test_rebuild_job.reference_path)

    assert not await test_motor.indexes.count()

    assert await test_motor.history.count({"index.id": "unbuilt", "index.version": "unbuilt"}) == 2
