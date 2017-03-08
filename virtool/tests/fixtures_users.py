import pytest

from virtool.permissions import PERMISSIONS
from virtool.users import Collection


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}


@pytest.fixture
def base_groups(all_permissions, no_permissions):
    return {
        "administrator": {
            "_id": "administrator",
            "permissions": all_permissions
        },

        "limited": {
            "_id": "limited",
            "permissions": no_permissions
        },

        "moderator": {
            "_id": "moderator",
            "permissions": dict(all_permissions, modify_options=False)
        },

        "technician": {
            "_id": "technician",
            "permissions": dict(no_permissions, add_sample=True, cancel_job=True)
        }
    }


@pytest.fixture
def make_groups(base_groups):
    def func(*args):
        return [base_groups[group_id] for group_id in args]

    return func


@pytest.fixture
def mangled_password():
    return "f0f8f5775f63c272dd835a445745e981a35fa8b978caf62a878427916af71c14e481084b8d36492d581f8f263015657cb41f24b" \
           "873ad1c8e1bcb8514c8b5a91d"


@pytest.fixture
def session():
    return {
        "ip": "127.0.0.1",
        "token": "4656ebf23aef7324c614933f",
        "timestamp": "2017-02-06T13:00:00.000000",
        "browser": {
            "name": "Firefox",
            "version": "51.0"
        }
    }


@pytest.fixture
def user_document():
    return {
        "_id": "bob",
        "_version": 1,
        "invalidate_sessions": False,
        "last_password_change": "2017-02-06T13:00:00.000000",
        "primary_group": "",
        "groups": [],
        "settings": {},
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
        "sessions": [],
        "force_reset": False,
        "salt": "8699041ecb71763ccef7937e",
        "password": "cbd4df372a380f57b45ba76b73e0e778cdd4edf881ef3db6a2232db02f1d2bb5"
                    "dd1489a2b10fa055d09924169f598d5094cd47e60c398b011df2a3cf03039ae1"

    }


@pytest.fixture
def find_promise(base_groups):
    class FindPromise:

        def __init__(self):
            self.return_value = [base_groups["limited"], base_groups["technician"]]

        def to_list(self, length=False):
            if length is False:
                raise ValueError("length must be defined")

            return self.return_value

    return FindPromise()


@pytest.fixture
def users_collection(mock_collection, mocker, mock_settings, base_groups, find_promise):
    collections = {
        "groups": mock_collection
    }

    collections["groups"].add_coroutine("dispatch")

    collections["groups"].add_coroutine("distinct")
    collections["groups"].stubs["distinct"].return_value = list(base_groups.keys())

    return Collection(
        mocker.stub(name="dispatch"),
        collections,
        mock_settings,
        mocker.stub(name="add_periodic_callback")
    )
