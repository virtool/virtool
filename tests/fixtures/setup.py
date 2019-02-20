import pytest


@pytest.fixture
def setup_defaults():
    return {
        "proxy": {
            "proxy": "",
            "ready": False,
            "error": ""
        },
        "db": {
            "db_connection_string": "",
            "db_name": "",
            "ready": False,
            "error": None
        },
        "user": {
            "id": "",
            "password": "",
            "placeholder": "",
            "ready": False,
            "error": None
        },
        "data": {
            "path": "",
            "ready": False,
            "error": ""
        },
        "watch": {
            "path": "",
            "ready": False,
            "error": ""
        }
    }
