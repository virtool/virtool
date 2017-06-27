import pytest


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
        "permissions": {
            "modify_options": False,
            "remove_virus": False,
            "add_virus": False,
            "add_host": False,
            "add_sample": False,
            "remove_job": False,
            "cancel_job": False,
            "archive_job": False,
            "remove_host": False,
            "modify_hmm": False,
            "modify_virus": False,
            "rebuild_index": False
        },
        "force_reset": False
    }
