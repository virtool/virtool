import pytest

from virtool.permissions import PERMISSIONS
from virtool.users import USER_SETTINGS, Collection, salt_hash, check_password


def test_init(mock_settings):

    init_collection = Collection(
        dispatch="dispatch",
        collections="collections",
        settings=mock_settings,
        add_periodic_callback="add_periodic_callback"
    )

    assert init_collection._dispatch == "dispatch"
    assert init_collection.collections == "collections"
    assert init_collection.settings == mock_settings
    assert init_collection.add_periodic_callback == "add_periodic_callback"

    assert set(init_collection.sync_projector) == {
        "_id",
        "_version",
        "groups",
        "sessions",
        "force_reset",
        "last_password_change",
        "permissions",
        "settings",
        "primary_group"
    }


class TestSetGroup:

    @pytest.mark.gen_test
    def test_add(self, mock_pymongo, mock_motor, mock_transaction, users_collection, user_document, base_groups, no_permissions):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_group",
            "data": {
                "user_id": "bob",
                "group_id": "technician"
            }
        }, permissions=["modify_options"])

        user_document["groups"] = ["limited"]

        yield users_collection.db.insert(user_document)

        yield mock_motor.groups.insert(base_groups.values())

        users_collection.collections["groups"].find = mock_motor.groups.find

        yield users_collection.set_group(transaction)

        user_document = mock_pymongo.users.find_one({"_id": "bob"})

        assert user_document["groups"] == ["limited", "technician"]

        assert user_document["permissions"] == dict(no_permissions, add_sample=True, cancel_job=True)

    @pytest.mark.gen_test
    def test_remove(self, mock_pymongo, mock_motor, mock_transaction, users_collection, user_document, base_groups, no_permissions):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_group",
            "data": {
                "user_id": "bob",
                "group_id": "technician"
            }
        }, permissions=["modify_options"])

        user_document["groups"] = ["limited", "technician"]

        yield users_collection.db.insert(user_document)

        yield mock_motor.groups.insert(base_groups.values())

        users_collection.collections["groups"].find = mock_motor.groups.find

        yield users_collection.set_group(transaction)

        user_document = mock_pymongo.users.find_one({"_id": "bob"})

        assert user_document["groups"] == ["limited"]

        assert user_document["permissions"] == no_permissions

    @pytest.mark.gen_test
    def test_administrator(self, mock_pymongo, mock_transaction, users_collection, user_document, base_groups):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_group",
            "data": {
                "user_id": "bob",
                "group_id": "administrator"
            }
        }, permissions=["modify_options"], username="bob")

        user_document["groups"] = ["administrator", "technician"]

        yield users_collection.db.insert(user_document)

        yield users_collection.set_group(transaction)

        user_document = mock_pymongo.users.find_one({"_id": "bob"})

        assert user_document["groups"] == ["administrator", "technician"]

        assert transaction.fulfill_called == (
            False,
            dict(message="Administrators cannot remove themselves from the administrator group", warning=True)
        )

    @pytest.mark.gen_test
    def test_user_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document, base_groups):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_group",
            "data": {
                "user_id": "fred",
                "group_id": "administrator"
            }
        }, permissions=["modify_options"], username="bob")

        yield users_collection.db.insert(user_document)

        yield users_collection.set_group(transaction)

        assert transaction.fulfill_called == (False, dict(message="User does not exist", warning=True))

    @pytest.mark.gen_test
    def test_group_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document, base_groups):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_group",
            "data": {
                "user_id": "bob",
                "group_id": "nonexistent"
            }
        }, permissions=["modify_options"], username="bob")

        user_document["groups"] = ["administrator", "technician"]

        yield users_collection.db.insert(user_document)

        yield users_collection.set_group(transaction)

        user_document = mock_pymongo.users.find_one({"_id": "bob"})

        assert user_document["groups"] == ["administrator", "technician"]

        assert transaction.fulfill_called == (False, dict(message="Group does not exist", warning=True))


class TestSetPrimaryGroup:

    @pytest.mark.gen_test
    def test_valid(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_primary_group",
            "data": {
                "_id": "bob",
                "group_id": "technician"
            }
        }, permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.set_primary_group(transaction)

        new_document = mock_pymongo.users.find_one()

        assert new_document["primary_group"] == "technician"

    @pytest.mark.gen_test
    def test_user_does_not_exist(self, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_primary_group",
            "data": {
                "_id": "fred",
                "group_id": "technician"
            }
        }, permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.set_primary_group(transaction)

        assert transaction.fulfill_called == (False, dict(message="User does not exist", warning=True))

    @pytest.mark.gen_test
    def test_group_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_primary_group",
            "data": {
                "_id": "bob",
                "group_id": "technicians"
            }
        }, permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.set_primary_group(transaction)

        new_document = mock_pymongo.users.find_one()

        assert transaction.fulfill_called == (False, dict(message="Group does not exist", warning=True))

        assert new_document["primary_group"] == ""


class TestChangeUserSetting:

    @pytest.mark.gen_test
    def test_known_setting(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "add",
            "data": {
                "key": "show_versions",
                "value": True
            }
        }, username="bob", permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.change_user_setting(transaction)

        new_document = mock_pymongo.users.find_one()

        assert new_document["settings"] != user_document["settings"]
        assert new_document["settings"]["show_versions"] is True

    @pytest.mark.gen_test
    def test_unknown_setting(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "add",
            "data": {
                "key": "foo",
                "value": "bar"
            }
        }, username="bob", permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.change_user_setting(transaction)

        assert mock_pymongo.users.find_one()["settings"] == user_document["settings"]

        assert transaction.fulfill_called == (False, dict(message="Unknown user setting foo", warning=True))


class TestAddUser:

    @pytest.mark.gen_test
    def test_valid(self, monkeypatch, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "add",
            "data": {
                "_id": "fred",
                "password": "foobar",
                "force_reset": True
            }
        }, permissions=["modify_options"])

        monkeypatch.setattr("virtool.utils.timestamp", lambda: "this_is_a_timestamp")

        yield users_collection.insert(user_document)

        yield users_collection.add(transaction)

        assert transaction.fulfill_called == (True, None)

        user_document = mock_pymongo.users.find_one({"_id": "fred"})

        expected = {
            "_id": "fred",
            "groups": [],
            "settings": USER_SETTINGS,
            "sessions": [],
            "permissions": {permission: False for permission in PERMISSIONS},
            "primary_group": "",
            "force_reset": True,
            "last_password_change": "this_is_a_timestamp",
            "invalidate_sessions": False
        }

        assert all(user_document[key] == expected[key] for key in expected)

        assert check_password("foobar", user_document["password"], user_document["salt"])

    @pytest.mark.gen_test
    def test_already_exists(self, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "add",
            "data": {
                "_id": "bob",
                "password": "foobar",
                "force_reset": True
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        yield users_collection.add(transaction)

        assert transaction.fulfill_called == (False, dict(message="User already exists.", warning=True))


class TestRemoveUser:

    @pytest.mark.gen_test
    def test_valid(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_user",
            "data": {
                "_id": "bob"
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        yield users_collection.remove_user(transaction)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 0

        assert transaction.fulfill_called[0] is True

    @pytest.mark.gen_test
    def test_remove_multiple(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_user",
            "data": {
                "_id": ["bob", "fred"]
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        yield users_collection.remove_user(transaction)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        assert transaction.fulfill_called == (
            False,
            dict(message="Can only remove one user per call", warning=True)
        )

    @pytest.mark.gen_test
    def test_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_user",
            "data": {
                "_id": "fred"
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        yield users_collection.remove_user(transaction)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        assert transaction.fulfill_called == (
            False,
            dict(message="User does not exist", warning=True)
        )

    @pytest.mark.gen_test
    def test_remove_self(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_user",
            "data": {
                "_id": "test"
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        yield users_collection.remove_user(transaction)

        assert mock_pymongo.users.find({"_id": "bob"}).count() == 1

        assert transaction.fulfill_called == (
            False,
            dict(message="User cannot remove their own account", warning=True)
        )


class TestChangePassword:

    def test_is_unprotected(self, users_collection):
        assert users_collection.change_password.is_unprotected

    @pytest.mark.gen_test
    def test_valid(self, monkeypatch, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "change_password",
            "data": {
                "_id": "bob",
                "new_password": "foobar",
                "old_password": "hello_world"
            }
        }, permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        monkeypatch.setattr("virtool.utils.timestamp", lambda: "this_is_a_timestamp")

        yield users_collection.change_password(transaction)

        user_document = mock_pymongo.users.find_one()

        assert check_password("foobar", user_document["password"], user_document["salt"])
        assert user_document["last_password_change"] == "this_is_a_timestamp"

    @pytest.mark.gen_test
    def test_wrong_old(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "change_password",
            "data": {
                "_id": "bob",
                "new_password": "foobar",
                "old_password": "wrong_password"
            }
        }, permissions=["modify_options"])

        yield users_collection.db.insert(user_document)

        yield users_collection.change_password(transaction)

        user_document = mock_pymongo.users.find_one()

        assert check_password("hello_world", user_document["password"], user_document["salt"])

        assert transaction.fulfill_called == (False, dict(message="Invalid credentials", warning=True))


class TestSetPassword:

    @pytest.mark.gen_test
    def test_exists(self, monkeypatch, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_password",
            "data": {
                "_id": "bob",
                "new_password": "foobar"
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        monkeypatch.setattr("virtool.utils.timestamp", lambda: "this_is_a_timestamp")

        yield users_collection.set_password(transaction)

        user_document = mock_pymongo.users.find_one()

        assert check_password("foobar", user_document["password"], user_document["salt"])
        assert not check_password("hello_world", user_document["password"], user_document["salt"])

        assert user_document["last_password_change"] == "this_is_a_timestamp"
        assert user_document["invalidate_sessions"] is True

        assert transaction.fulfill_called[0] is True

    @pytest.mark.gen_test
    def test_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_password",
            "data": {
                "_id": "fred",
                "new_password": "foobar"
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        yield users_collection.set_password(transaction)

        assert transaction.fulfill_called == (False, dict(message="User does not exist", warning=True))


class TestSetForceReset:

    @pytest.mark.gen_test
    def test_exists(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_force_reset",
            "data": {
                "_id": "bob",
                "force_reset": True
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"force_reset": True}).count() == 0
        assert mock_pymongo.users.find({"force_reset": False}).count() == 1

        yield users_collection.set_force_reset(transaction)

        assert mock_pymongo.users.find({"force_reset": True}).count() == 1
        assert mock_pymongo.users.find({"force_reset": False}).count() == 0

        assert transaction.fulfill_called[0] is True

    @pytest.mark.gen_test
    def test_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "set_force_reset",
            "data": {
                "_id": "fred",
                "force_reset": True
            }
        }, permissions=["modify_options"])

        yield users_collection.insert(user_document)

        assert mock_pymongo.users.find({"force_reset": True}).count() == 0
        assert mock_pymongo.users.find({"force_reset": False}).count() == 1

        yield users_collection.set_force_reset(transaction)

        assert mock_pymongo.users.find({"force_reset": True}).count() == 0
        assert mock_pymongo.users.find({"force_reset": False}).count() == 1

        assert transaction.fulfill_called == (False, dict(message="User does not exist", warning=True))


class TestAuthorizeByLogin:

    @pytest.mark.gen_test
    @pytest.mark.parametrize("credentials", [
        {"username": "fred", "password": "hello_world"},
        {"username": "bob", "password": "wrong_password"}
    ])
    def test_bad_credentials(self, mock_transaction, users_collection, user_document, credentials):
        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_login",
            "data": credentials
        }, authorized=False)

        yield users_collection.db.insert(user_document)

        yield users_collection.authorize_by_login(transaction)

        assert transaction.fulfill_called == (
            False,
            dict(message="Incorrect username or password", force_reset=False, warning=True)
        )

    @pytest.mark.gen_test
    def test_simple(self, monkeypatch, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_login",
            "data": {
                "username": "bob",
                "password": "hello_world",
                "browser": "browser"
            }
        }, authorized=False)

        monkeypatch.setattr("virtool.utils.timestamp", lambda: "this_is_a_timestamp")
        monkeypatch.setattr("virtool.utils.random_alphanumeric", lambda x: "this_is_a_token")

        yield users_collection.db.insert(user_document)

        yield users_collection.authorize_by_login(transaction)

        user_document = yield users_collection.find_one({"_id": user_document["_id"]})

        assert user_document["sessions"] == [{
            "timestamp": "this_is_a_timestamp",
            "token": "this_is_a_token",
            "ip": "127.0.0.1",
            "browser": "browser"
        }]

        assert transaction.connection.user["_id"] == "bob"
        assert transaction.connection.authorized is True

    @pytest.mark.gen_test
    def test_force_reset(self, monkeypatch, mock_transaction, users_collection, user_document):
        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_login",
            "data": {
                "username": "bob",
                "password": "hello_world",
                "browser": "browser"
            }
        }, authorized=False)

        user_document["force_reset"] = True

        yield users_collection.db.insert(user_document)

        monkeypatch.setattr("virtool.utils.timestamp", lambda: "this_is_a_timestamp")
        monkeypatch.setattr("virtool.utils.random_alphanumeric", lambda x: "this_is_a_token")

        yield users_collection.authorize_by_login(transaction)

        user_document = yield users_collection.find_one({"_id": "bob"})

        assert user_document["sessions"] == [{
            "timestamp": "this_is_a_timestamp",
            "token": "this_is_a_token",
            "ip": "127.0.0.1",
            "browser": "browser"
        }]

        assert transaction.connection.user["_id"] == "bob"
        assert transaction.connection.authorized is False

        assert transaction.fulfill_called == (
            False,
            dict(message="Password must be reset", force_reset=True, warning=True)
        )

    @pytest.mark.gen_test
    def test_remove_expired(self, mock_transaction, users_collection, user_document, session):
        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_login",
            "data": {
                "username": "bob",
                "password": "hello_world",
                "browser": {
                    "name": "Firefox",
                    "version": "52.0"
                }
            }
        }, authorized=False)

        user_document["sessions"] = [session]

        yield users_collection.db.insert(user_document)

        yield users_collection.authorize_by_login(transaction)

        user_document = yield users_collection.find_one({"_id": "bob"})

        assert len(user_document["sessions"]) == 1

        assert user_document["sessions"][0]["ip"] == "127.0.0.1"
        assert user_document["sessions"][0]["browser"] == {
            "name": "Firefox",
            "version": "52.0"
        }

        assert user_document["sessions"][0]["token"] != session["token"]

        assert transaction.connection.user["_id"] == "bob"
        assert transaction.connection.authorized is True

        assert transaction.fulfill_called[0] is True

        user_document["token"] = user_document["sessions"][0]["token"]

        user_document_items = user_document.items()

        assert all([item in user_document_items for item in transaction.fulfill_called[1].items()])


class TestAuthorizeByToken:

    def test_is_unprotected(self, users_collection):
        assert users_collection.authorize_by_token.is_unprotected

    @pytest.mark.gen_test
    def test_does_not_exist(self, mock_transaction, users_collection, user_document, session):
        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_token",
            "data": {
                "token": "this_does_not_exist",
                "browser": "Firefox"
            }
        }, authorized=False)

        yield users_collection.authorize_by_token(transaction)

        assert transaction.fulfill_called == (False, dict(message="Token does not exist", warning=True))

        assert not transaction.connection.authorized

        assert transaction.connection.user["_id"] is None

    @pytest.mark.gen_test
    def test_conflicting_browser(self, mock_transaction, users_collection, user_document, session):
        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_token",
            "data": {
                "token": session["token"],
                "browser": {
                    "name": "Chrome",
                    "version": "56"
                }
            }
        }, authorized=False)

        yield users_collection.authorize_by_token(transaction)

        assert transaction.fulfill_called == (False, dict(message="Token is invalid", warning=True))

        assert not transaction.connection.authorized

        assert transaction.connection.user["_id"] is None

    @pytest.mark.gen_test
    def test_conflicting_ip(self, mock_transaction, users_collection, user_document, session):
        # This session has conflicting IP and browser info.
        session.update({
            "ip": "8.8.8.8"
        })

        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_token",
            "data": {
                "token": session["token"],
                "browser": {
                    "name": "Firefox"
                }
            }
        }, authorized=False)

        yield users_collection.authorize_by_token(transaction)

        assert transaction.fulfill_called == (False, dict(message="Token is invalid", warning=True))

        assert not transaction.connection.authorized

        assert transaction.connection.user["_id"] is None

    @pytest.mark.gen_test
    def test_invalidate_flag(self, mock_transaction, users_collection, user_document, session):
        user_document.update({
            "sessions": [session],
            "invalidate_sessions": True
        })

        yield users_collection.db.insert(user_document)

        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_token",
            "data": {
                "token": session["token"],
                "browser": {
                    "name": "Firefox"
                }
            }
        }, authorized=False)

        yield users_collection.authorize_by_token(transaction)

        assert transaction.connection.authorized is False

        assert transaction.connection.user["_id"] is None

        assert transaction.fulfill_called == (False, dict(message="Token was invalidated", warning=True))

        user_document = yield users_collection.find_one({"_id": user_document["_id"]})

        assert user_document["sessions"] == []

    @pytest.mark.gen_test
    def test_exists(self, mock_transaction, users_collection, user_document, session):
        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        transaction = mock_transaction({
            "interface": "users",
            "method": "authorize_by_token",
            "data": {
                "token": session["token"],
                "browser": {
                    "name": "Firefox"
                }
            }
        }, authorized=False)

        yield users_collection.authorize_by_token(transaction)

        user_dispatch = {key: user_document[key] for key in [
            "_id",
            "groups",
            "last_password_change",
            "primary_group",
            "permissions",
            "settings"
        ]}

        user_dispatch["token"] = session["token"]

        assert transaction.fulfill_called == (True, user_dispatch)

        assert transaction.connection.authorized

        assert transaction.connection.user["_id"] == "bob"


class TestRemoveSession:

    @pytest.mark.gen_test
    def test_exists(self, mock_pymongo, mock_transaction, users_collection, user_document, session):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_session",
            "data": {
                "token": session["token"]
            }
        }, permissions=["modify_options"])

        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        yield users_collection.remove_session(transaction)

        assert mock_pymongo.users.count({"sessions.token": session["token"]}) == 0

        assert transaction.fulfill_called == (True, None)

    @pytest.mark.gen_test
    def test_does_not_exist(self, mock_pymongo, mock_transaction, users_collection, user_document, session):
        transaction = mock_transaction({
            "interface": "users",
            "method": "remove_session",
            "data": {
                "token": "this_does_not_exist"
            }
        }, permissions=["modify_options"])

        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        yield users_collection.remove_session(transaction)

        assert mock_pymongo.users.count({"sessions.token": session["token"]}) == 1

        assert transaction.fulfill_called == (False, dict(message="Session does not exist", warning=True))


class TestLogout:

    @pytest.mark.gen_test
    def test_valid(self, mock_transaction, users_collection, user_document, session, coroutine_stub):
        transaction = mock_transaction({
            "interface": "users",
            "method": "logout"
        })

        transaction.connection.user["token"] = session["token"]

        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        users_collection.invalidate_session = coroutine_stub("invalidate_sessions")

        yield users_collection.logout(transaction)

        assert users_collection.invalidate_session.stub.call_count == 1

        args, kwargs = users_collection.invalidate_session.stub.call_args

        assert args == (session["token"],)
        assert kwargs["logout"] is True


class TestValidateLogin:

    @pytest.mark.gen_test
    def test_valid(self, users_collection, user_document):
        yield users_collection.db.insert(user_document)

        return_value = yield users_collection.validate_login("bob", "hello_world")

        assert return_value == user_document

    @pytest.mark.gen_test
    def test_invalid(self, users_collection, user_document):
        yield users_collection.db.insert(user_document)

        return_value = yield users_collection.validate_login("bob", "foobar")

        assert return_value is False

    @pytest.mark.gen_test
    def test_username_does_not_exist(self, users_collection, user_document):
        yield users_collection.db.insert(user_document)

        return_value = yield users_collection.validate_login("fred", "foobar")

        assert return_value is False


class TestInvalidateSession:

    @pytest.mark.gen_test
    @pytest.mark.parametrize("logout", [True, False])
    def test_exists(self, mock_pymongo, users_collection, user_document, session, logout):
        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 1

        return_value = yield users_collection.invalidate_session("4656ebf23aef7324c614933f", logout=logout)

        assert return_value

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 0

        assert users_collection._dispatch.call_count == 3

        assert users_collection._dispatch.call_args[0][0] == {
            "operation": "deauthorize",
            "data": {
                "logout": logout
            }
        }

    @pytest.mark.gen_test
    @pytest.mark.parametrize("logout", [True, False])
    def test_does_not_exist(self, mock_pymongo, users_collection, user_document, session, logout):
        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 1

        return_value = yield users_collection.invalidate_session("abc123abc123xyz987281abc", logout=logout)

        assert not return_value

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 1

        assert users_collection._dispatch.call_count == 1

    @pytest.mark.gen_test
    def test_duplicate_token(self, mock_pymongo, users_collection, user_document, session):
        print(session)

        user_document["sessions"].append(session)

        yield users_collection.db.insert(user_document)

        user_document["_id"] = "fred"

        yield users_collection.db.insert(user_document)

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 2

        with pytest.raises(ValueError) as err:
            yield users_collection.invalidate_session("4656ebf23aef7324c614933f")

        assert "Multiple sessions matching token {}".format("4656ebf23aef7324c614933f") in str(err)

        assert mock_pymongo.users.find({"sessions.token": "4656ebf23aef7324c614933f"}).count() == 2


class TestUpdateUserPermissions:

    @pytest.mark.gen_test
    def test_valid(self):
        pass


class TestUserExists:

    @pytest.mark.gen_test
    def test_exists(self, users_collection, user_document):
        yield users_collection.db.insert(user_document)

        exists = yield users_collection.user_exists("bob")

        assert exists

    @pytest.mark.gen_test
    def test_does_not_exist(self, users_collection, user_document):
        yield users_collection.db.insert(user_document)

        exists = yield users_collection.user_exists("foobar")

        assert not exists


class TestPasswordSaltHash:

    def test_valid(self):
        salt, hashed = salt_hash("hello_world")

        assert len(salt) == 24
        assert check_password("hello_world", hashed, salt)

    def test_invalid(self):
        salt, hashed = salt_hash("foobar")

        assert len(salt) == 24
        assert not check_password("foobar1", hashed, salt)
