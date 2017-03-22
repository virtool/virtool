import os
import shutil
import pytest

from virtool.hmm import Collection

DIRNAME = os.path.dirname(os.path.realpath(__file__))
ANNOTATION_PATH = os.path.join(DIRNAME, "test_files", "annotations")


@pytest.fixture
def hmm_pressed():
    return {
        "profiles.hmm.h3p": 531878,
        "profiles.hmm.h3f": 195593,
        "profiles.hmm.h3m": 453461,
        "profiles.hmm.h3i": 395
    }


@pytest.fixture
def annotation_path(tmpdir):
    path = os.path.join(str(tmpdir), "annotations")
    shutil.copytree(ANNOTATION_PATH, path)
    return str(path)


@pytest.fixture
def expected_annotations():
    return [
        {"length": 133, "mean_entropy": 0.53, "count": 208, "cluster": 5, "total_entropy": 70.49},
        {"length": 356, "mean_entropy": 0.52, "count": 253, "cluster": 2, "total_entropy": 185.12},
        {"length": 96, "mean_entropy": 0.56, "count": 210, "cluster": 4, "total_entropy": 53.76},
        {"length": 505, "mean_entropy": 0.52, "count": 113, "cluster": 10, "total_entropy": 262.6},
        {"length": 612, "mean_entropy": 0.52, "count": 101, "cluster": 8, "total_entropy": 318.24},
        {"length": 136, "mean_entropy": 0.53, "count": 216, "cluster": 3, "total_entropy": 72.08},
        {"length": 500, "mean_entropy": 0.47, "count": 97, "cluster": 9, "total_entropy": 235.0}
    ]


@pytest.fixture
def hmm_path(tmpdir):
    hmm_dir_path = os.path.join(str(tmpdir), "hmm")
    os.mkdir(hmm_dir_path)

    src_path = os.path.join(DIRNAME, "test_files", "test.hmm")

    hmm_file_path = os.path.join(hmm_dir_path, "profiles.hmm")
    shutil.copyfile(src_path, hmm_file_path)

    return str(tmpdir), hmm_file_path


@pytest.fixture
def pressed_hmm_path(hmm_path):
    for extension in ["h3f", "h3i", "h3m", "h3p"]:
        shutil.copyfile(
            os.path.join(DIRNAME, "test_files", "test.hmm.{}".format(extension)),
            os.path.join(hmm_path[0], "hmm", "profiles.hmm.{}".format(extension))
        )

    return hmm_path[0], os.path.join(hmm_path[0], "hmm")


@pytest.fixture
def bad_hmm_path(hmm_path):
    with open(hmm_path[1], "a") as hmm_file:
        hmm_file.write("foo1bar2hello3world4")

    return hmm_path[1]


@pytest.fixture
def hmm_stat_result():
    return [
        {"cluster": 2, "length": 356, "count": 253},
        {"cluster": 3, "length": 136, "count": 216},
        {"cluster": 4, "length": 96, "count": 210},
        {"cluster": 5, "length": 133, "count": 208},
        {"cluster": 8, "length": 612, "count": 101},
        {"cluster": 9, "length": 500, "count": 97},
        {"cluster": 10, "length": 505, "count": 113}
    ]


@pytest.fixture
def hmm_document():
    return {
        "_id": "f8666902",
        "count": 4,
        "length": 199,
        "definition": [
            "ORF-63",
            "ORF67",
            "hypothetical protein"
        ],
        "entries": [
            {
                "gi": "438000415",
                "organism": "Thysanoplusia orichalcea nucleopolyhedrovirus",
                "name": "hypothetical protein",
                "accession": "YP_007250520.1"
            },
            {
                "gi": "114679914",
                "organism": "Leucania separata nucleopolyhedrovirus",
                "name": "ORF67",
                "accession": "YP_758364.1"
            },
            {
                "gi": "209170953",
                "organism": "Agrotis ipsilon multiple nucleopolyhedrovirus",
                "name": "agip69",
                "accession": "YP_002268099.1"
            },
            {
                "gi": "90592780",
                "organism": "Agrotis segetum nucleopolyhedrovirus",
                "name": "ORF-63",
                "accession": "YP_529733.1"
            }
        ],
        "total_entropy": 101.49,
        "families": {
            "Baculoviridae": 3
        },
        "_version": 0,
        "genera": {
            "Alphabaculovirus": 3
        },
        "cluster": 3463,
        "mean_entropy": 0.51,
        "label": "ORF-63"
    }


@pytest.fixture
def hmm_collection(mocker, mock_settings):
    return Collection(
        mocker.stub(name="dispatch"),
        {},
        mock_settings,
        mocker.stub(name="add_periodic_callback")
    )


@pytest.fixture
def hmm_check_result():
    return {
        "files": [
            "profiles.hmm",
            "profiles.hmm.h3f",
            "profiles.hmm.h3i",
            "profiles.hmm.h3m",
            "profiles.hmm.h3p"
        ],
        "errors": {
            "hmm_dir": False,
            "hmm_file": False,
            "press": False,
            "not_in_file": False,
            "not_in_database": False
        }
    }


@pytest.fixture
def hmm_check_transaction(mock_transaction):
    return mock_transaction({
        "interface": "hmm",
        "method": "check_files"
    })


@pytest.fixture
def hmm_documents():
    return [
        {"cluster": 2},
        {"cluster": 3},
        {"cluster": 4},
        {"cluster": 5},
        {"cluster": 8},
        {"cluster": 9},
        {"cluster": 10}
    ]
