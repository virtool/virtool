import pytest
import filecmp
import json
import os
import pickle
import shutil
import sys

import virtool.bio
import virtool.jobs.nuvs

TEST_FILES_PATH = os.path.join(sys.path[0], "tests", "test_files")
NUVS_PATH = os.path.join(TEST_FILES_PATH, "nuvs")
INDEX_PATH = os.path.join(TEST_FILES_PATH, "index", "reference")
FASTQ_PATH = os.path.join(TEST_FILES_PATH, "test.fq")
HOST_PATH = os.path.join(TEST_FILES_PATH, "index", "host")


@pytest.fixture
def mock_job(mocker, tmpdir, request, dbs, test_db_connection_string):
    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    # Copy read files.
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    settings = {
        "data_path": str(tmpdir)
    }

    job = virtool.jobs.nuvs.Job(
        test_db_connection_string,
        "virtool",
        settings,
        "foo",
        mocker.Mock()
    )

    job.db = dbs

    job.proc = 2
    job.proc = 8

    job.params = {
        "sample_path": os.path.join(str(tmpdir), "samples", "foobar"),
        "analysis_id": "baz",
        "analysis_path": os.path.join(str(tmpdir), "samples", "foobar", "analysis", "baz"),
        "index_path": INDEX_PATH,
        "subtraction_path": HOST_PATH,
        "read_paths": [
            os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
        ]
    }

    return job


@pytest.mark.parametrize("exists", [True, False])
def test_make_analysis_dir(exists, mock_job):
    """
    Test that the stage method creates an analysis directory. If one already exists, it should throw an exception.

    """
    if exists:
        os.makedirs(mock_job.params["analysis_path"])

    if exists:
        with pytest.raises(FileExistsError) as err:
            mock_job.make_analysis_dir()

        assert "[Errno 17] File exists" in str(err)

        return

    mock_job.make_analysis_dir()

    assert os.path.exists(mock_job.params["analysis_path"])


def test_map_otus(mock_job):

    os.mkdir(mock_job.params["analysis_path"])

    mock_job.map_otus()

    actual_path = os.path.join(mock_job.params["analysis_path"], "unmapped_otus.fq")

    with open(actual_path, "r") as f:
        actual = [line.rstrip() for line in f]
        actual = {tuple(actual[i:i + 4]) for i in range(0, len(actual), 4)}

    expected_path = os.path.join(NUVS_PATH, "unmapped_otus.fq")

    with open(expected_path, "r") as f:
        expected = [line.rstrip() for line in f]
        expected = {tuple(expected[i:i + 4]) for i in range(0, len(expected), 4)}

    assert actual == expected


def test_map_subtraction(mock_job):
    os.mkdir(mock_job.params["analysis_path"])

    shutil.copy(
        os.path.join(NUVS_PATH, "unmapped_otus.fq"),
        os.path.join(mock_job.params["analysis_path"], "unmapped_otus.fq")
    )

    mock_job.map_subtraction()


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
def test_reunite_pairs(is_paired, mock_job):
    """
    Test that paired reads are reordered properly after a single-ended mapping process. Verify that nothing happens
    if the sample is not paired.

    """
    os.mkdir(mock_job.params["analysis_path"])

    unite = None

    if is_paired:
        unite_path = os.path.join(NUVS_PATH, "unite.json")

        with open(unite_path, "r") as f:
            unite = json.load(f)

        l_path, r_path = [os.path.join(mock_job.params["sample_path"], "reads_{}.fq".format(i)) for i in (1, 2)]

        for path, key in [(l_path, "left"), (r_path, "right")]:
            with open(path, "w") as f:
                for line in unite[key]:
                    f.write(line + "\n")

        mock_job.params["read_paths"] = [l_path, r_path]

        separate_path = os.path.join(mock_job.params["analysis_path"], "unmapped_hosts.fq")

        with open(separate_path, "w") as f:
            for line in unite["separate"]:
                f.write(line + "\n")

    mock_job.params["paired"] = is_paired

    mock_job.reunite_pairs()

    if is_paired:
        for path, key in [("unmapped_1.fq", "united_left"), ("unmapped_2.fq", "united_right")]:
            with open(os.path.join(mock_job.params["analysis_path"], path), "r") as f:
                lines = [l.rstrip() for l in f]

            assert lines == unite[key]


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
def test_assemble(is_paired, mock_job):
    os.mkdir(mock_job.params["analysis_path"])

    mock_job.params["paired"] = is_paired
    mock_job.params["srna"] = False

    mock_job.proc = 2
    mock_job.mem = 10

    if is_paired:
        for suffix in (1, 2):
            shutil.copy(
                os.path.join(NUVS_PATH, "reads_{}.fq".format(suffix)),
                os.path.join(mock_job.params["analysis_path"], "unmapped_{}.fq".format(suffix))
            )
    else:
        shutil.copy(
            os.path.join(NUVS_PATH, "reads_1.fq"),
            os.path.join(mock_job.params["analysis_path"], "unmapped_hosts.fq")
        )

    mock_job.assemble()

    test_fasta_path = os.path.join(
        NUVS_PATH,
        "scaffolds_{}.fa".format("p" if is_paired else "u")
    )

    real_fasta_path = os.path.join(
        mock_job.params["analysis_path"],
        "assembly.fa"
    )

    test_data = virtool.bio.read_fasta(test_fasta_path)
    real_data = virtool.bio.read_fasta(real_fasta_path)

    assert {item[1] for item in test_data} == {item[1] for item in real_data}


def test_process_fasta(mock_job):
    os.mkdir(mock_job.params["analysis_path"])

    shutil.copy(
        os.path.join(NUVS_PATH, "scaffolds_u.fa"),
        os.path.join(mock_job.params["analysis_path"], "assembly.fa")
    )

    mock_job.process_fasta()

    # Make sure the results attribute matches the expected value.
    with open(os.path.join(NUVS_PATH, "process_fasta"), "rb") as f:
        assert pickle.load(f) == mock_job.results

    # Make sure the orf.fa file is correct.
    assert filecmp.cmp(
        os.path.join(mock_job.params["analysis_path"], "orfs.fa"),
        os.path.join(NUVS_PATH, "orfs.fa")
    )


def test_press_hmm(mock_job):
    os.mkdir(mock_job.params["analysis_path"])

    hmm_path = os.path.join(mock_job.settings["data_path"], "hmm")

    os.mkdir(hmm_path)

    shutil.copyfile(
        os.path.join(NUVS_PATH, "test.hmm"),
        os.path.join(hmm_path, "profiles.hmm")
    )

    mock_job.press_hmm()

    listing = os.listdir(mock_job.params["analysis_path"])

    # Check that all the pressed file were written to the analysis directory.
    assert all("profiles.hmm." + suffix in listing for suffix in ["h3p", "h3m", "h3f", "h3i"])


def test_vfam(mock_job, dbs):
    os.mkdir(mock_job.params["analysis_path"])

    dbs.hmm.insert_many([
        {
            "_id": "foo",
            "cluster": 2
        },
        {
            "_id": "bar",
            "cluster": 9
        }
    ])

    with open(os.path.join(mock_job.params["analysis_path"], "orfs.fa"), "w") as f:
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
            os.path.join(NUVS_PATH, "test.hmm." + suffix),
            os.path.join(mock_job.params["analysis_path"], "profiles.hmm." + suffix)
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

    mock_job.vfam()

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


def test_import_results(mock_job, dbs):
    """
    Test that the stage method saves the result list to the analysis database document and updated the algorithm tags on
    the associated sample document.

    """
    dbs.samples.insert_one({
        "_id": "foobar",
        "pathoscope": False,
        "nuvs": "ip"
    })

    dbs.analyses.insert_one({
        "_id": "baz",
        "ready": False,
        "algorithm": "nuvs",
        "sample": {
            "id": "foobar"
        }
    })

    mock_job.params["sample_id"] = "foobar"

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

    mock_job.import_results()

    assert dbs.samples.find_one() == {
        "_id": "foobar",
        "pathoscope": False,
        "nuvs": True
    }

    assert dbs.analyses.find_one() == {
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
