import pytest

from virtool.testing.fixtures import called_tester


@pytest.fixture
def connection():
    return lambda settings: MockConnection(settings)


@pytest.fixture
def blind_connection(called_tester):
    return MockConnection({
        "add_connection": called_tester(),
        "remove_connection": called_tester(),
        "handle_message": called_tester()
    })


class MockConnection:

    def __init__(self, settings):
        self.handle_message = settings["handle_message"]
        self.add_connection = settings["add_connection"]
        self.remove_connection = settings["remove_connection"]

        #: The IP address of the remote connection.
        self.ip = "10.10.1.10"

        #: A dict describing the user associated with the websocket connection. If the connection is not authorized,
        #: the attribute is assigned ``{"_id": None}``.
        self.user = {"_id": None}

        #: Set to ``True`` when the connection is authorized.
        self.authorized = False

        self.messages = []

    def check_origin(self, origin):
        return True

    def open(self):
        self.add_connection(self)

    def on_message(self, message):
        self.handle_message(message, self)

    def on_close(self):
        self.remove_connection(self)

    def write_message(self, message):
        self.messages.append(message)

