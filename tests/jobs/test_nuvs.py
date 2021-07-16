import operator

import pytest
import filecmp
import json
import os
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
async def mock_job(mocker, tmpdir, request, dbi, test_db_connection_string, test_db_name):
    # Add logs path.
    tmpdir.mkdir("logs").mkdir("jobs")

    # Add sample path.
    tmpdir.mkdir("samples").mkdir("foobar").mkdir("analysis")

    # Copy read files.
    shutil.copyfile(FASTQ_PATH, os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq"))

    settings = {
        "data_path": str(tmpdir),
        "db_connection_string": test_db_connection_string,
        "db_name": test_db_name
    }

    job = virtool.jobs.nuvs.create()

    job.db = dbi
    job.id = "foobar"
    job.mem = 4
    job.proc = 1
    job.settings = settings

    job.params = {
        "analysis_id": "baz",
        "analysis_path": os.path.join(str(tmpdir), "samples", "foobar", "analysis", "baz"),
        "index_path": INDEX_PATH,
        "read_paths": [
            os.path.join(str(tmpdir), "samples", "foobar", "reads_1.fq")
        ],
        "sample_path": os.path.join(str(tmpdir), "samples", "foobar"),
        "subtraction_path": HOST_PATH,
        "temp_analysis_path": os.path.join(str(tmpdir), "temp", "temp_analysis")
    }

    os.makedirs(job.params["temp_analysis_path"])

    return job


async def test_eliminate_otus(mock_job):
    await virtool.jobs.nuvs.eliminate_otus(mock_job)

    actual_path = os.path.join(mock_job.params["temp_analysis_path"], "unmapped_otus.fq")

    with open(actual_path, "r") as f:
        actual = [line.rstrip() for line in f]
        actual = {tuple(actual[i:i + 4]) for i in range(0, len(actual), 4)}

    expected_path = os.path.join(NUVS_PATH, "unmapped_otus.fq")

    with open(expected_path, "r") as f:
        expected = [line.rstrip() for line in f]
        expected = {tuple(expected[i:i + 4]) for i in range(0, len(expected), 4)}

    assert actual == expected


async def test_map_subtraction(mock_job):
    shutil.copy(
        os.path.join(NUVS_PATH, "unmapped_otus.fq"),
        os.path.join(mock_job.params["temp_analysis_path"], "unmapped_otus.fq")
    )

    await virtool.jobs.nuvs.eliminate_subtraction(mock_job)


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
async def test_reunite_pairs(is_paired, mock_job):
    """
    Test that paired reads are reordered properly after a single-ended mapping process. Verify that nothing happens
    if the sample is not paired.

    """
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

        separate_path = os.path.join(mock_job.params["temp_analysis_path"], "unmapped_hosts.fq")

        with open(separate_path, "w") as f:
            for line in unite["separate"]:
                f.write(line + "\n")

    mock_job.params["paired"] = is_paired

    await virtool.jobs.nuvs.reunite_pairs(mock_job)

    if is_paired:
        for path, key in [("unmapped_1.fq", "united_left"), ("unmapped_2.fq", "united_right")]:
            with open(os.path.join(mock_job.params["temp_analysis_path"], path), "r") as f:
                lines = [l.rstrip() for l in f]

            assert lines == unite[key]


@pytest.mark.parametrize("is_paired", [False, True], ids=["unpaired", "paired"])
async def test_assemble(is_paired, mock_job):
    mock_job.params["paired"] = is_paired
    mock_job.params["library_type"] = "normal"
    mock_job.proc = 2

    if is_paired:
        for suffix in (1, 2):
            shutil.copy(
                os.path.join(NUVS_PATH, "reads_{}.fq".format(suffix)),
                os.path.join(mock_job.params["temp_analysis_path"], "unmapped_{}.fq".format(suffix))
            )
    else:
        shutil.copy(
            os.path.join(NUVS_PATH, "reads_1.fq"),
            os.path.join(mock_job.params["temp_analysis_path"], "unmapped_hosts.fq")
        )

    await virtool.jobs.nuvs.assemble(mock_job)

    test_fasta_path = os.path.join(
        NUVS_PATH,
        "scaffolds_{}.fa".format("p" if is_paired else "u")
    )

    real_fasta_path = os.path.join(
        mock_job.params["temp_analysis_path"],
        "assembly.fa"
    )

    test_data = virtool.bio.read_fasta(test_fasta_path)
    real_data = virtool.bio.read_fasta(real_fasta_path)

    assert {item[1] for item in test_data} == {item[1] for item in real_data}


async def test_process_fasta(snapshot, mock_job):
    shutil.copy(
        os.path.join(NUVS_PATH, "scaffolds_u.fa"),
        os.path.join(mock_job.params["temp_analysis_path"], "assembly.fa")
    )

    await virtool.jobs.nuvs.process_fasta(mock_job)

    sorted_sequences = sorted(mock_job.results["sequences"], key=operator.itemgetter("index"))

    snapshot.assert_match(sorted_sequences)

    # Make sure the orf.fa file is correct.
    assert filecmp.cmp(
        os.path.join(mock_job.params["temp_analysis_path"], "orfs.fa"),
        os.path.join(NUVS_PATH, "orfs.fa")
    )


async def test_press_hmm(mock_job):

    hmm_path = os.path.join(mock_job.settings["data_path"], "hmm")

    os.mkdir(hmm_path)

    shutil.copyfile(
        os.path.join(NUVS_PATH, "test.hmm"),
        os.path.join(hmm_path, "profiles.hmm")
    )

    await virtool.jobs.nuvs.prepare_hmm(mock_job)

    listing = os.listdir(mock_job.params["temp_analysis_path"])

    # Check that all the pressed file were written to the analysis directory.
    assert all("profiles.hmm." + suffix in listing for suffix in ["h3p", "h3m", "h3f", "h3i"])


async def test_vfam(capsys, snapshot, dbi, mock_job):
    await dbi.hmm.insert_many([
        {
            "_id": "foo",
            "cluster": 2
        },
        {
            "_id": "bar",
            "cluster": 9
        }
    ])

    with open(os.path.join(mock_job.params["temp_analysis_path"], "orfs.fa"), "w") as f:
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
            os.path.join(mock_job.params["temp_analysis_path"], "profiles.hmm." + suffix)
        )

    mock_job.results = {
        "sequences": [
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
    }

    await virtool.jobs.nuvs.vfam(mock_job)

    snapshot.assert_match(mock_job.results)

