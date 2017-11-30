import pytest

import virtool.user_permissions


@pytest.fixture
def user_document():
    return {
        "_id": "bob",
        "invalidate_sessions": False,
        "last_password_change": "2017-10-06T13:00:00.000000",
        "primary_group": "",
        "groups": [],
        "settings": {
            "quick_analyze_algorithm": "pathoscope_bowtie",
            "show_ids": True,
            "show_versions": True,
            "skip_quick_analyze_dialog": True
        },
        "permissions": {p: False for p in virtool.user_permissions.PERMISSIONS},
        "force_reset": False
    }
