import filecmp
import json
import os
import pytest
import random
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor

import virtool.bio
import virtool.job
import virtool.sample_analysis


TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")
UNITE_PATH = os.path.join(TEST_FILES_PATH, "unite.json")


@pytest.fixture
async def synthetic_library():

    seq_a = "GGAATTCCTTAGACACGTGCGTTAACACCATCTAGAACACTCCCATAATAGGGACAATCCTTGGATCCAATGAGCTCGCTGGAAAGTGCTGAAGCTCGTAACAA" \
            "AGACAACCTGAGGCTCCCGGCAGCTCATAAGTTAGGGTGTTCACTTCGGGGGCCTATGGTTATCAAGTATCCAGATTTTGGCGTTCCATTCCCAGTGCAATCCA" \
            "ATGTCTATGGTTGCCGCAGCACCACGCGGTATTTAATCTTCCTAGACTTCTATCAGGAATCAGCTTAATCCTAGGTCTTTTGCCCACTATGCGTGATAACGCTC" \
            "GCCAAGCTCCGCGGGTCACAGTGGAATTATGCGCAATCCTCTGGATAGGGGCCCGTTGGCGGGGGGACCAGTCAGCAATAGTCCCAATTCGGTAAAGCGGGTAC" \
            "AGGCTTGTCTCATAAGGTGGGTCCTCGAATTGGGTAACTCCCACCGCAGAGCAAGATACAATATTCACAGGCAGCGCTCAGGCCAAGCAAGATAAACAGTATCG" \
            "TATGATATAATCTGTGGAACGACGTAAGCCGCGGCAACGACGACATCGGTCGTCGATGGATTTGTAGCTTGTCGTGGATATGGAAAGATGCATCAGTCCGACAC" \
            "ACGGTGGTTCATTTCCTCGTCCACTTGTTACATTGGCATTCGTTTCATGTACGGACGCAGGTACGGGCTATGTATTCGGAAAGCCCGGATCCCGCATTAGATAC" \
            "TCAGTCTAGATTCTCTCAATATTTTCCGAGCCCTCCGGTTCCCTAGTTAAAACTTTTGCTCCAATTACGGCTTAAGCTTTACTACGGATGATACGCTTTAGCCG" \
            "CCCTCGTGGAATACGCAGAGACTCCGTAACCAGTGCGATATGTCAATATACGACACAGTCTTGAGGTGACTAGGCCATAACTGCTACCCACCACAGCGACTCCG" \
            "TAGATAAGTAGGACCCCTTTCAAAGCCTTCGCGCAGAAAAATTGTACATGGCCTCATGCCCGCAGGTACGTATTTAGACTACGGTTTAACGAGCTTCGACTGGA"

    seq_b = "CTTGATTGCGGCAAGCAAAACCTGAACACCGGTGCGACGATCAATCAACCAGGGGGTACCCTATTTGGTCCGCTGACGTGCCGTTTACTGAGTGAGTTTTCAGT" \
            "TGAGCGAAGGTCCGAAGGGCGTCCGATGAGAATACCACGGCCAGTTACGCCGGGCTACACCAGTAGACAACTAAGCTCACCCTCAACTTCCAGGCGGCGGATGT" \
            "AGTTCTAAGTTGTGCTTAATGCACTTGCGACGGAATTCTCTCTCAAGAGAGGTGATCTTTGAAGGATGACGAAAAGTAGGTATAGCGCAACGAGCAATATCGTC" \
            "GCCAAATCAGGATCGATATTTTGAGATACACGTGCACATATTCAAGGGAATAATTCCGCATTGTAGAATGGCACGATATATTCAACTTTGGATCCTCCCGCGTG" \
            "TGGTATCGCCCTCTGGCAGCTCATCATCTTCGCCGCGCGTACCAGCTTAAGGGCGCTGCCTCTAACGACTCAGCGCAATGAGGCCGCAAACTAGTCAACCGCAG" \
            "GGTCGAGTACCTAATATCGACAGATACAATCCAGTCAACAGTACGCATGTGACAGTTGTGGGTATTATAATGATAGTACCTAAGTGAAAGTTCGGGTTTAAAAC" \
            "AGATCAAGACCAGGAACACCTCCGCTACTAACCGAGAGCCGTCTGCGCCGCAACAGAGTTCTATTCGTCCGACCATTCCCGCCCAAAAGTGGATAACGTCGAGC" \
            "CAGATCTTATCAGTAGTATGTGGGCTGCGACCCCCGTGGGGAGGTGTCTCGTGACGAAATGTAGAGTCATTCGCACGATAATTAGAACACCCCTCTTCGATGTC" \
            "ACGGGGCTGCGGCTCGTCCCTCCGACGGTCACCCGATGATGGGGTAAACGACGTATGCAATACAAGTTCGTACTTAAATTGAGTTGCCGGAGGAACAAGTCGTG" \
            "CGATGTGAGACTATTGCGTTGATCTCATGGTTCCGATCAATCTTAATCCTAACCCACTCGTCCGGAGACTCCGCAGCGACTTCAAGGTTTTAGGAAAAAACCAT"

    def func(paired=False, length=75):
        reads = list()

        for seq in (seq_a, seq_b):
            for _ in range(0, 1000):
                start = random.choice(0, 965)
                reads.append(seq[start: start + 75])

        return reads


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


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
async def test_reunite_pairs(is_paired, mock_job):
    """
    Test that paired reads are reordered properly after a single-ended mapping process. Verify that nothing happens
    if the sample is not paired.

    """
    os.mkdir(mock_job.analysis_path)

    if is_paired:
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
        "paired": is_paired
    }

    await mock_job.reunite_pairs()

    if is_paired:
        for path, key in [("unmapped_1.fq", "united_left"), ("unmapped_2.fq", "united_right")]:
            with open(os.path.join(mock_job.analysis_path, path), "r") as f:
                lines = [l.rstrip() for l in f]

            assert lines == unite[key]


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
async def test_assemble(is_paired, mock_job, capsys):
    os.mkdir(mock_job.analysis_path)

    mock_job.sample = {
        "paired": is_paired
    }

    mock_job.proc = 2
    mock_job.mem = 10

    if is_paired:
        for suffix in (1, 2):
            shutil.copy(
                os.path.join(TEST_FILES_PATH, "reads_{}.fq".format(suffix)),
                os.path.join(mock_job.analysis_path, "unmapped_{}.fq".format(suffix))
            )
    else:
        shutil.copy(
            os.path.join(TEST_FILES_PATH, "reads_1.fq"),
            os.path.join(mock_job.analysis_path, "unmapped_hosts.fq")
        )

    await mock_job.assemble()

    test_fasta_path = os.path.join(TEST_FILES_PATH, "scaffolds_{}.fa".format("p" if is_paired else "u"))
    real_fasta_path = os.path.join(mock_job.analysis_path, "assembly.fa")

    test_data = virtool.bio.read_fasta(test_fasta_path)
    real_data = virtool.bio.read_fasta(real_fasta_path)

    assert {item[1] for item in test_data} == {item[1] for item in real_data}
