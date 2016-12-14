import json
import pytest

from virtool.dispatcher import Transaction


@pytest.fixture(scope="function")
def fake_message():
    return {
        "tid": 9029401982,
        "interface": "foo",
        "method": "test_exposed_method",
        "data": {
            "value": "foobar"
        }
    }


@pytest.fixture(scope="function")
def expected_dispatch(fake_message):
    def create_expected(success=True, message="Hello world"):
        return {
            "collection_name": "transaction",
            "operation": "fulfill",
            "data": {
                "tid": fake_message["tid"],
                "success": success,
                "data": {"message": message}
            }
        }

    return create_expected


@pytest.fixture(scope="function")
def fake_json(fake_message):
    return json.dumps(fake_message)


@pytest.fixture(scope="function", params=["method", "interface", "data"])
def optional_json(request, fake_message):
    del fake_message[request.param]
    return request.param, json.dumps(fake_message)


@pytest.fixture(scope="function")
def transaction(called_tester, fake_json):
    return Transaction(called_tester(), fake_json, "THIS IS A FAKE CONNECTION")


class TestInit:

    def test_json(self, transaction, fake_message):
        assert transaction.message == fake_message

    def test_dispatch(self, fake_json, called_tester):
        dispatch = called_tester()
        assert Transaction(dispatch, fake_json, "THIS IS A FAKE CONNECTION").dispatch == dispatch

    def test_attrs(self, transaction, fake_message):
        assert transaction.connection == "THIS IS A FAKE CONNECTION"
        assert transaction.tid == fake_message["tid"]
        assert transaction.method == "test_exposed_method"
        assert transaction.interface == "foo"
        assert transaction.data == {"value": "foobar"}
        assert transaction.response is None

    def test_optional_attrs(self, called_tester, optional_json):
        key, message = optional_json
        trans = Transaction(called_tester(), message, "THIS IS A FAKE CONNECTION")
        assert getattr(trans, key) is None

    def test_no_tid(self, fake_message, called_tester):
        del fake_message["tid"]
        with pytest.raises(KeyError) as excinfo:
            Transaction(called_tester(), json.dumps(fake_message), "THIS IS A FAKE CONNECTION")

        assert "Received message has no TID" in str(excinfo.value)

    def test_invalid_tid(self, fake_message, called_tester):
        fake_message["tid"] = "2131245125"

        with pytest.raises(TypeError) as excinfo:
            Transaction(called_tester(), json.dumps(fake_message), "THIS IS A FAKE CONNECTION")

        assert "TID must be an instance of int" in str(excinfo.value)


class TestFulfill:

    def test_default(self, transaction, expected_dispatch):
        transaction.fulfill(True, dict(message="Hello world"))
        assert transaction.dispatch.with_args[0] == expected_dispatch()
        assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]

    def test_failed(self, transaction, expected_dispatch):
        transaction.fulfill(False, dict(message="Hello world"))
        assert transaction.dispatch.with_args[0] == expected_dispatch(success=False)
        assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]

    def test_failed_no_data(self, transaction, expected_dispatch):
        transaction.fulfill(False)

        d = expected_dispatch(success=False)
        d["data"]["data"] = {"message": "Error"}

        assert transaction.dispatch.with_args[0] == d
        assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]

    def test_with_response(self, transaction, expected_dispatch):
        transaction.response = "Foo bar"
        transaction.fulfill(True)

        d = expected_dispatch()
        d["data"]["data"] = "Foo bar"

        assert transaction.dispatch.with_args[0] == d
        assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]

    def test_override_response(self, transaction, expected_dispatch):
        transaction.response = "Foo bar"
        transaction.fulfill(True, dict(message="Hello world"))

        assert transaction.dispatch.with_args[0] == expected_dispatch()
        assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]


def test_update(transaction, expected_dispatch):
    transaction.update({"value": "Foo bar"})

    assert transaction.dispatch.with_args[0] == {
        "collection_name": "transaction",
        "operation": "update",
        "data": {
            "tid": 9029401982,
            "data": {"value": "Foo bar"}
        }
    }

    assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]

    transaction.fulfill(True, dict(message="Hello world"))

    assert transaction.dispatch.with_args[0] == expected_dispatch()
    assert transaction.dispatch.with_args[1] == ["THIS IS A FAKE CONNECTION"]
