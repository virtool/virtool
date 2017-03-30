import pytest


@pytest.fixture
def authorize(test_db, user_document, no_permissions):
    def func(response, user_id="test", groups=None, permissions=no_permissions):
        groups = groups or list()

        update = {
            "user_id": user_id,
            "groups": groups,
            "permissions": permissions
        }

        test_db.users.insert(user_document)

        document = test_db.sessions.find_one_and_update(
            {"_id": response.cookies["session_id"]},
            {"$set": update},
            return_document=pymongo.ReturnDocument.AFTER
        )

        return document

    return func


@pytest.fixture
def do_get(test_db, test_client, authorize):
    pass


@pytest.fixture
def do_get(test_db, test_client):
    pass


@pytest.fixture
def do_get(test_db, test_client):
    pass


@pytest.fixture
def do_get(test_db, test_client):
    pass