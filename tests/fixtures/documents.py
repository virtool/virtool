import pytest

import virtool.users.utils


@pytest.fixture
def hmm_document():
    return {
        "_id": "f8666902",
        "count": 4,
        "length": 199,
        "names": ["ORF-63", "ORF67", "hypothetical protein"],
        "entries": [
            {
                "gi": "438000415",
                "organism": "Thysanoplusia orichalcea nucleopolyhedrovirus",
                "name": "hypothetical protein",
                "accession": "YP_007250520.1",
            },
            {
                "gi": "114679914",
                "organism": "Leucania separata nucleopolyhedrovirus",
                "name": "ORF67",
                "accession": "YP_758364.1",
            },
            {
                "gi": "209170953",
                "organism": "Agrotis ipsilon multiple nucleopolyhedrovirus",
                "name": "agip69",
                "accession": "YP_002268099.1",
            },
            {
                "gi": "90592780",
                "organism": "Agrotis segetum nucleopolyhedrovirus",
                "name": "ORF-63",
                "accession": "YP_529733.1",
            },
        ],
        "total_entropy": 101.49,
        "families": {"Baculoviridae": 3},
        "genera": {"Alphabaculovirus": 3},
        "cluster": 3463,
        "mean_entropy": 0.51,
    }


@pytest.fixture
def user_document():
    return {
        "_id": "bob",
        "invalidate_sessions": False,
        "last_password_change": "2017-10-06T13:00:00.000000",
        "primary_group": "",
        "groups": [],
        "settings": {
            "quick_analyze_workflow": "pathoscope_bowtie",
            "show_ids": True,
            "show_versions": True,
            "skip_quick_analyze_dialog": True,
        },
        "permissions": {p: False for p in virtool.users.utils.PERMISSIONS},
        "force_reset": False,
    }
