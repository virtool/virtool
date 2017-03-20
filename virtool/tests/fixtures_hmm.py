import os
import shutil
import pytest

from virtool.hmm import Collection

HMM_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), "test_files", "test.hmm")


@pytest.fixture
def hmm_checksums():
    return {
        "f837b40b9385833f0cebc45028c2e526",
        "64e9dfcd68284f5a44033ff6101d5919",
        "4eb31059425f2f83a241918800e124db",
        "87281cc69d87bbc571b5ed68e546fa81"
    }


@pytest.fixture
def hmm_path(tmpdir):
    shutil.copy(HMM_PATH, str(tmpdir))
    path = os.path.join(str(tmpdir), "test.hmm")
    return path


@pytest.fixture
def bad_hmm_path(hmm_path):
    with open(hmm_path, "a") as hmm_file:
        hmm_file.write("foo1bar2hello3world4")

    return hmm_path


@pytest.fixture
def hmm_stat_result():
    return [
        {'cluster': 2, 'length': 356, 'count': 253},
        {'cluster': 3, 'length': 136, 'count': 216},
        {'cluster': 4, 'length': 96, 'count': 210},
        {'cluster': 5, 'length': 133, 'count': 208},
        {'cluster': 8, 'length': 612, 'count': 101},
        {'cluster': 9, 'length': 500, 'count': 97},
        {'cluster': 10, 'length': 505, 'count': 113}
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
