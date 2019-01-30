import pytest

import virtool.setup.db
import virtool.users


async def test_add_first_user(dbi, static_time):
    await virtool.setup.db.add_first_user(dbi, "bob", "hashed")\

    assert await dbi.users.find_one() == {
        "_id": "bob",
        # A list of group _ids the user is associated with.
        "administrator": True,
        "groups": list(),
        "identicon": "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9",
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": False,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "permissions": {p: True for p in virtool.users.PERMISSIONS},
        "password": "hashed",
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": False,
        # A timestamp taken at the last password change.
        "last_password_change": static_time.datetime,
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }


@pytest.mark.parametrize("error", [None, "name_error", "connection_error"])
async def test_check_setup(error, test_db_connection_string, test_db_name):
    """
    Test the function used for validating MongoDB connection strings and database names. This test DOES NOT check the
    authentication error failure case.

    """
    db_connection_string = test_db_connection_string

    if error == "connection_error":
        db_connection_string = f"mongodb://www.example.com:27017/{test_db_name}"

    db_name = "virtool-setup-test"

    if error == "name_error":
        db_name = "virtool.setup.test"

    result = await virtool.setup.db.check_setup(db_connection_string, db_name)

    if error is None:
        assert result == {
            "db_connection_string": db_connection_string,
            "db_name": db_name,
            "ready": True,
            "error": None
        }

    elif error == "name_error":
        assert result == {
            "db_connection_string": db_connection_string,
            "db_name": "",
            "ready": False,
            "error": "name_error"
        }

    elif error == "connection_error":
        assert result == {
            "db_connection_string": "",
            "db_name": "",
            "ready": False,
            "error": "connection_error"
        }



