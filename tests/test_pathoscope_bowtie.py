import os
import sys
import shutil
import pytest
from concurrent.futures import ProcessPoolExecutor

import virtool.job
import virtool.sample_analysis


INDEX_PATH = os.path.join(sys.path[0], "tests", "test_files", "index")
FASTQ_PATH = os.path.join(sys.path[0], "tests", "test_files", "test.fq")


@pytest.fixture
async def mock_job(tmpdir, loop, test_motor, test_dispatch):
    # Add index files.
    shutil.copytree(INDEX_PATH, os.path.join(str(tmpdir), "reference", "viruses", "index"))

    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    # Copy read files.
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    executor = ProcessPoolExecutor()

    settings = {
        "data_path": str(tmpdir)
    }

    task_args = {
        "sample_id": "foobar",
        "analysis_id": "baz",
        "index_id": "index"
    }

    job = virtool.sample_analysis.PathoscopeBowtie(
        loop,
        executor,
        test_motor,
        settings,
        test_dispatch,
        "foobar",
        "pathoscope_bowtie",
        task_args,
        1,
        4
    )

    return job


async def test_map_viruses(tmpdir, mock_job):
    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    await mock_job.map_viruses()

    assert mock_job.intermediate["to_viruses"] == {
        "NC_013110",
        "NC_017938",
        "NC_006057",
        "NC_007448",
        "JQ080272",
        "NC_001836",
        "NC_003347",
        "NC_016509",
        "NC_017939",
        "NC_006056",
        "NC_003623",
        "KX109927",
        "NC_016416",
        "NC_001948",
        "NC_021148",
        "NC_003615",
        "NC_004006"
    }


async def test_map_isolates(capsys, tmpdir, mock_job):
    mock_job.read_paths = [
        os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
    ]

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")
    index_path = os.path.join(str(tmpdir), "reference", "viruses", "index")

    os.mkdir(os.path.join(sample_path, "analysis", "baz"))

    for filename in os.listdir(index_path):
        shutil.copyfile(
            os.path.join(index_path, filename),
            os.path.join(sample_path, "analysis", "baz", filename.replace("reference", "isolates"))
        )

    mock_job.proc = 2

    with capsys.disabled():
        await mock_job.map_isolates()
        vta_path = os.path.join(mock_job.analysis_path, "to_isolates.vta")
        assert os.path.getsize(vta_path) == 50090
