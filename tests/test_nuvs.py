import filecmp
import json
import os
import pickle
import pytest
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor

import virtool.bio
import virtool.job
import virtool.sample_analysis


TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
TEST_NUVS_PATH = os.path.join(TEST_FILES_PATH, "nuvs")
INDEX_PATH = os.path.join(TEST_FILES_PATH, "index")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")
UNITE_PATH = os.path.join(TEST_NUVS_PATH, "unite.json")


@pytest.fixture
async def mock_job(loop, mocker, tmpdir, test_motor, test_dispatch):
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
        mocker.stub("capture_exception"),
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
        os.path.join(TEST_NUVS_PATH, "unmapped_viruses.fq")
    )


async def test_map_subtraction(mock_job):
    os.mkdir(mock_job.analysis_path)

    mock_job.subtraction_path = os.path.join(TEST_FILES_PATH, "index", "host")

    shutil.copy(
        os.path.join(TEST_NUVS_PATH, "unmapped_viruses.fq"),
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
async def test_assemble(is_paired, mock_job):
    os.mkdir(mock_job.analysis_path)

    mock_job.sample = {
        "paired": is_paired
    }

    mock_job.proc = 2
    mock_job.mem = 10

    if is_paired:
        for suffix in (1, 2):
            shutil.copy(
                os.path.join(TEST_NUVS_PATH, "reads_{}.fq".format(suffix)),
                os.path.join(mock_job.analysis_path, "unmapped_{}.fq".format(suffix))
            )
    else:
        shutil.copy(
            os.path.join(TEST_NUVS_PATH, "reads_1.fq"),
            os.path.join(mock_job.analysis_path, "unmapped_hosts.fq")
        )

    await mock_job.assemble()

    test_fasta_path = os.path.join(TEST_NUVS_PATH, "scaffolds_{}.fa".format("p" if is_paired else "u"))
    real_fasta_path = os.path.join(mock_job.analysis_path, "assembly.fa")

    test_data = virtool.bio.read_fasta(test_fasta_path)
    real_data = virtool.bio.read_fasta(real_fasta_path)

    assert {item[1] for item in test_data} == {item[1] for item in real_data}


async def test_process_fasta(mock_job):
    os.mkdir(mock_job.analysis_path)

    shutil.copy(
        os.path.join(TEST_NUVS_PATH, "scaffolds_u.fa"),
        os.path.join(mock_job.analysis_path, "assembly.fa")
    )

    await mock_job.process_fasta()

    # Make sure the results attribute matches the expected value.
    with open(os.path.join(TEST_NUVS_PATH, "process_fasta"), "rb") as f:
        assert pickle.load(f) == mock_job.results

    # Make sure the orf.fa file is correct.
    assert filecmp.cmp(os.path.join(mock_job.analysis_path, "orfs.fa"), os.path.join(TEST_NUVS_PATH, "orfs.fa"))


async def test_press_hmm(mock_job):
    os.mkdir(mock_job.analysis_path)

    hmm_path = os.path.join(mock_job.data_path, "hmm")

    os.mkdir(hmm_path)

    shutil.copyfile(
        os.path.join(TEST_FILES_PATH, "test.hmm"),
        os.path.join(hmm_path, "profiles.hmm")
    )

    await mock_job.press_hmm()

    listing = os.listdir(mock_job.analysis_path)

    # Check that all the pressed file were written to the analysis directory.
    assert all("profiles.hmm." + suffix in listing for suffix in ["h3p", "h3m", "h3f", "h3i"])


async def test_vfam(mock_job, test_motor):
    os.mkdir(mock_job.analysis_path)

    await test_motor.hmm.insert_many([
        {
            "_id": "foo",
            "cluster": 2
        },
        {
            "_id": "bar",
            "cluster": 9
        }
    ])

    with open(os.path.join(mock_job.analysis_path, "orfs.fa"), "w") as f:
        f.write(">sequence_0.0\n")
        f.write(
            "MVAVRAPRRKRASATDLYKTCKAAGTCPPDVIPKIEGSTLADKILQWSGLGIFLGGLGIGTGTGSGGRTGYIPLGGGGRPSVVDIGPTRPPIIIEPVGPTEPSIVT"
            "LVEESSIIQSGAPIPTFSGGNGFELTTSSATTPAVLDITPSAGTVHVTSTNIQNPLYIEPPIDIPQAGEASGHIFTTTSTAGTHSYEEIPMEVFASTNGTGLEPIS"
            "STPIPGIQRVSAPRLYSKAYQQVKVTDPNFIGNPSTFVTFDNPAYEPIDETLTYASSSTVAPDPDFLDIIALHRPALTSRKGTVRYSRLGQKATMKTRSGKQIGAT"
            "VHYYHDISPIQSFAEHEEIELQPLHTSTHSSAPLFDIYADPDTVPSIHTPRMSYSPTTLPVPRYASNVFSSINTSTTNVTVPLSTSFELPVYSGSDIYTPTSSPTW"
            "PSLPPPPTTNLPAIVVHGDNYYLWPYIYLIHKRRKRMPYFFSDGFVAY"
        )
        f.write("\n>sequence_2.0\n")
        f.write(
            "MSSLVSETSNSEVGSQMESPGRGGQSIDAPSSSCFKVRARNLFLTYSKCNLTAVFLLEYISSLLKKYCPTYIYVAQEAHKDGSHHLHCIIQCSKYVRTTSAKFFDI"
            "KEFHPNVQNPRMPKKALSYCKKSPISEAEYGVFQEIKRPRKKKADAPSTKDAKMAEIIKSSTNKEDYLSMVRKSFPFDWATRLQQFQFSAESLFPSTPPPYVDPFG"
            "MPSQDTHPVIGAWLRDELYTDRSPTERRRSLYICGPTRTGKTSWARSLGSHNYWQHSVDFLHVIQNARYNVIDDIPFKFVPCWKGLVGSQKDITVNPKYGKKRLLS"
            "NGIPCIILVNEDEDWLQQMQPSQADWFNANAVVHYMYSGESFFEAL"
        )

    for suffix in ["h3p", "h3m", "h3f", "h3i"]:
        shutil.copyfile(
            os.path.join(TEST_FILES_PATH, "test.hmm." + suffix),
            os.path.join(mock_job.analysis_path, "profiles.hmm." + suffix)
        )

    mock_job.results = [
        {
            "orfs": [
                {"name": "Foo"}
            ]
        },
        {},
        {
            "orfs": [
                {"name": "Bar"}
            ]
        }
    ]

    await mock_job.vfam()

    assert mock_job.results == [
        {
            'orfs': [
                {
                    'name': 'Foo',
                    'hits': [
                        {
                            'best_bias': 440.3,
                            'best_e': 5e-135,
                            'best_score': 4.5,
                            'full_bias': 4.5,
                            'full_e': 3.9e-135,
                            'full_score': 440.7,
                            'hit': 'bar'
                        }
                    ]
                }
            ]
        },
        {},
        {
            'orfs': [
                {
                    'name': 'Bar',
                    'hits': [
                        {
                            'best_bias': 400.7,
                            'best_e': 1.7e-123,
                            'best_score': 0.8,
                            'full_bias': 0.8,
                            'full_e': 1.4e-123,
                            'full_score': 401.0,
                            'hit': 'foo'
                        }
                    ]
                }
            ]
        }
    ]


async def test_import_results(mock_job, test_motor):
    """
    Test that the stage method saves the result list to the analysis database document and updated the algorithm tags on
    the associated sample document.

    """
    await test_motor.samples.insert_one({
        "_id": "foobar",
        "pathoscope": False,
        "nuvs": "ip"
    })

    await test_motor.analyses.insert_one({
        "_id": "baz",
        "ready": False,
        "algorithm": "nuvs",
        "sample": {
            "id": "foobar"
        }
    })

    mock_job.results = [
        {
            'orfs': [
                {
                    'name': 'Foo',
                    'hits': [
                        {
                            'best_bias': 440.3,
                            'best_e': 5e-135,
                            'best_score': 4.5,
                            'full_bias': 4.5,
                            'full_e': 3.9e-135,
                            'full_score': 440.7,
                            'hit': 'bar'
                        }
                    ]
                }
            ]
        },
        {},
        {
            'orfs': [
                {
                    'name': 'Bar',
                    'hits': [
                        {
                            'best_bias': 400.7,
                            'best_e': 1.7e-123,
                            'best_score': 0.8,
                            'full_bias': 0.8,
                            'full_e': 1.4e-123,
                            'full_score': 401.0,
                            'hit': 'foo'
                        }
                    ]
                }
            ]
        }
    ]

    await mock_job.import_results()

    assert await test_motor.samples.find_one() == {
        "_id": "foobar",
        "pathoscope": False,
        "nuvs": True
    }

    assert await test_motor.analyses.find_one() == {
        "_id": "baz",
        "ready": True,
        "algorithm": "nuvs",
        "sample": {
            "id": "foobar"
        },
        "results": [
            {
                'orfs': [
                    {
                        'name': 'Foo',
                        'hits': [
                            {
                                'best_bias': 440.3,
                                'best_e': 5e-135,
                                'best_score': 4.5,
                                'full_bias': 4.5,
                                'full_e': 3.9e-135,
                                'full_score': 440.7,
                                'hit': 'bar'
                            }
                        ]
                    }
                ]
            },
            {},
            {
                'orfs': [
                    {
                        'name': 'Bar',
                        'hits': [
                            {
                                'best_bias': 400.7,
                                'best_e': 1.7e-123,
                                'best_score': 0.8,
                                'full_bias': 0.8,
                                'full_e': 1.4e-123,
                                'full_score': 401.0,
                                'hit': 'foo'
                            }
                        ]
                    }
                ]
            }
        ]
    }
