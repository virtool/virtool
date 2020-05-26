import asyncio.events
import concurrent.futures.thread
import os
import sys
import tempfile

import pytest

import virtool.jobs.analysis
import virtool.jobs.pathoscope

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")


class MockAnalysisJob:

    def __init__(self, temp_dir):
        self.temp_dir = temp_dir

        self.settings = dict()
        self.params = dict()

        self.executor = concurrent.futures.thread.ThreadPoolExecutor()

    async def run_in_executor(self, *args):
        return asyncio.events.get_event_loop().run_in_executor(self.executor, *args)


@pytest.fixture
async def mock_job(tmpdir, mocker, request, dbi):
    temp_dir = tempfile.TemporaryDirectory()

    await dbi.jobs.insert_one({
        "_id": "foobar",
        "task": "pathoscope_bowtie",
        "args": {
            "sample_id": "foobar",
            "analysis_id": "baz",
            "ref_id": "original",
            "index_id": "index3"
        },
        "proc": 2,
        "mem": 8
    })

    await dbi.indexes.insert_one({
        "_id": "index3",
        "manifest": {
            "foobar": 10,
            "reo": 5,
            "baz": 6
        },
        "sequence_otu_map": {
            "foo": "reo",
            "bar": "foobar",
            "boo": "baz"
        }
    })

    await dbi.analyses.insert_one({
        "_id": "baz",
        "subtraction": {
            "id": "boo"
        }
    })

    await dbi.samples.insert_one({
        "_id": "foobar",
        "library_type": "srna",
        "paired": False,
        "quality": {
            "count": 1337,
            "length": [35, 76],
        }
    })

    job = MockAnalysisJob(temp_dir)

    job.db = dbi
    job.id = "foobar"
    job.settings = {
        "data_path": str(tmpdir)
    }

    job.task_args = {
        "sample_id": "foobar",
        "ref_id": "original",
        "analysis_id": "baz",
        "index_id": "index3"
    }

    job.params["temp_analysis_path"] = os.path.join(temp_dir.name, "baz")
    job.params["raw_path"] = os.path.join(temp_dir.name, "raw")
    job.params["reads_path"] = os.path.join(temp_dir.name, "reads")

    yield job

    temp_dir.cleanup()


async def test_make_analysis_dir(dbs, mock_job):
    await virtool.jobs.analysis.make_analysis_dir(mock_job)
    assert set(os.listdir(mock_job.temp_dir.name)) == {"raw", "baz", "reads"}


@pytest.mark.parametrize("paired", [False, True])
async def test_check_db(tmpdir, paired, dbi, mock_job):
    """
    Check that the method assigns various job attributes based on information from the database.

    """
    await dbi.samples.update_one({"_id": "foobar"}, {
        "$set": {
            "paired": paired
        }
    })

    await dbi.subtraction.insert_many([
        {"_id": "Arabidopsis thaliana"},
        {"_id": "Prunus persica"},
    ])

    sample_path = os.path.join(str(tmpdir), "samples", "foobar")

    await virtool.jobs.analysis.check_db(mock_job)

    assert mock_job.params["read_count"] == 1337

    expected_read_filenames = ["reads_1.fastq"]

    if paired:
        expected_read_filenames.append("reads_2.fastq")

    assert mock_job.params["subtraction_path"] == os.path.join(
        str(tmpdir),
        "subtractions",
        "boo",
        "reference"
    )
