import pytest

import virtool.setup.db
import virtool.users


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



