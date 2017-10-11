import filecmp
import json
import os
import pytest
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor

import virtool.sample_analysis


TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")
UNITE_PATH = os.path.join(TEST_FILES_PATH, "unite.json")


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

    job = virtool.sample_analysis.NuVs(
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


async def test_map_viruses(mock_job):
    os.mkdir(mock_job.analysis_path)

    mock_job.read_paths = [
        os.path.join(mock_job.sample_path, "reads_1.fq")
    ]

    await mock_job.map_viruses()

    assert filecmp.cmp(
        os.path.join(mock_job.analysis_path, "unmapped_viruses.fq"),
        os.path.join(TEST_FILES_PATH, "unmapped_viruses.fq")
    )


async def test_map_subtraction(mock_job):
    os.mkdir(mock_job.analysis_path)

    mock_job.host_path = os.path.join(TEST_FILES_PATH, "index", "host")

    shutil.copy(
        os.path.join(TEST_FILES_PATH, "unmapped_viruses.fq"),
        os.path.join(mock_job.analysis_path, "unmapped_viruses.fq")
    )

    await mock_job.map_subtraction()


async def test_reunite_pairs(mock_job):
    os.mkdir(mock_job.analysis_path)

    with open(UNITE_PATH, "r") as f:
        unite = json.load(f)

    l_path, r_path = [os.path.join(mock_job.sample_path, "reads_{}.fq".format(i)) for i in (1, 2)]

    for path, key in [(l_path, "left"), (r_path, "right")]:
        with open(path, "w") as f:
            for line in unite[key]:
                f.write(line + "\n")

    mock_job.read_paths = [l_path, r_path]

    separate_path = os.path.join(mock_job.analysis_path, "unmapped_hosts.fq")

    with open(separate_path, "w") as f:
        for line in unite["separate"]:
            f.write(line + "\n")

    mock_job.sample = {
        "paired": True
    }

    await mock_job.reunite_pairs()
