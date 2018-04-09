import pytest

import virtool.db.account
import virtool.db.users
import virtool.users
import virtool.utils


@pytest.mark.parametrize("validated", [True, False])
@pytest.mark.parametrize("has_old", [True, False])
async def test_compose_password_update(validated, has_old, test_motor):

    password = "hello_world"

    # Will evaluate true if the passed username and password are correct.
    if not await virtool.db.users.validate_credentials(db, user_id, old_password):
        raise ValueError("Invalid credentials")

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    return {
        "password": virtool.users.hash_password(password),
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "force_reset": False
    }
