import os
import pytest
from concurrent.futures import ProcessPoolExecutor

import virtool.jobs.create_sample


@pytest.fixture
def test_create_sample_job(mocker, tmpdir, loop, test_motor, test_dispatch):
    tmpdir.mkdir("samples")
    tmpdir.mkdir("logs").mkdir("jobs")

    executor = ProcessPoolExecutor()

    settings = {
        "data_path": str(tmpdir),
        "create_sample_proc": 6
    }

    job = virtool.jobs.create_sample.CreateSample(
        loop,
        executor,
        test_motor,
        settings,
        test_dispatch,
        mocker.stub("capture_exception"),
        "foobar",
        "create_sample",
        dict(sample_id="foobar", files=["foobar.fastq"], paired=False),
        6,
        12
    )

    return job


@pytest.mark.parametrize("exists", [None, "sample", "analysis"])
def test_force_makedirs(exists, tmpdir):
    """
    Test that the function makes the specified sample tree even if the sample path and/or the analysis path already
    exist.

    """
    sample_path = os.path.join(str(tmpdir), "foobar")

    if exists is not None:
        os.mkdir(sample_path)

        if exists == "analysis":
            os.mkdir(os.path.join(sample_path, "analysis"))

    virtool.jobs.create_sample.force_makedirs(sample_path)

    assert os.listdir(str(tmpdir)) == ["foobar"]
    assert os.listdir(sample_path) == ["analysis"]


@pytest.mark.parametrize("paired", [True, False])
def test_move_trimming_results(paired, tmpdir):
    """
    Test the trimmed reads are renamed correctly whether the library is ``paired`` or not.

    """
    log = tmpdir.join("reads-trimmed.log")
    log.write("This is the log file")

    if not paired:
        first = tmpdir.join("reads-trimmed.fastq")
        first.write("This is a single-ended file")
    else:
        first = tmpdir.join("reads-trimmed-pair1.fastq")
        first.write("This is pair 1")

        second = tmpdir.join("reads-trimmed-pair2.fastq")
        second.write("This is pair 2")

    path = str(tmpdir)

    virtool.jobs.create_sample.move_trimming_results(path, paired=paired)

    if paired:
        for pair in (1, 2):
            if paired == 1 or paired:
                fastq_path = os.path.join(path, "reads_{}.fastq".format(pair))

                with open(fastq_path, "r") as handle:
                    assert handle.read() == "This is pair {}".format(pair)

    log_path = os.path.join(path, "trim.log")

    with open(log_path, "r") as handle:
        assert handle.read() == "This is the log file"


async def test_make_sample_dir(tmpdir, test_create_sample_job):
    await test_create_sample_job.make_sample_dir()

    samples_path = os.path.join(str(tmpdir), "samples")

    assert os.listdir(samples_path) == ["foobar"]

    assert os.listdir(os.path.join(samples_path, "foobar")) == ["analysis"]
