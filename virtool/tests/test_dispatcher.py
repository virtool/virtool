import pytest
import inspect

from virtool.dispatcher import Dispatcher


@pytest.fixture(scope="function")
def temp_settings(settings):
    def create_settings(d):
        settings.update(d)
        return settings

    yield create_settings

    settings.reset()


@pytest.fixture
def default_args(called_tester, temp_settings, temp_mongo):
    class DefaultArgs:

        def __init__(self, settings_data={}):
            self.add_periodic_callback = called_tester()
            self.add_future = called_tester()
            self.reload = called_tester()
            self.shutdown = called_tester()
            self.settings = temp_settings(settings_data)
            self.db = temp_mongo

        def as_list(self):
            return [
                self.add_periodic_callback,
                self.add_future,
                self.reload,
                self.shutdown,
                self.settings,
                self.db
            ]

    return DefaultArgs({"server_ready": True})


class TestInit:

    def test_attributes(self, default_args):

        dispatcher = Dispatcher(*default_args.as_list())

        assert "virtool.files.Watcher" in str(type(dispatcher.watcher))
        assert "virtool.files.Manager" in str(type(dispatcher.file_manager))

    def test_ping(self, default_args):

        Dispatcher(*default_args.as_list())

        callback = default_args.add_periodic_callback

        assert callback.was_called
        assert callback.with_args[0].__name__ == "ping"
        assert callback.with_args[1] == 10000


class TestBindCollections:

    def test_unready_collections(self, default_args):
        dispatcher = Dispatcher(*default_args.as_list())

        for collection_name, value in dispatcher.collections.items():
            if collection_name is "settings":
                assert not inspect.isclass(value)
            else:
                assert inspect.isclass(value)


class TestConnection:

    def test_add_connection(self, default_args, connection):

        dispatcher = Dispatcher(*default_args.as_list())

        conn = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        assert dispatcher.connections == []

        conn.open()

        assert dispatcher.connections == [conn]

    def test_remove_connection(self, default_args, connection):
        dispatcher = Dispatcher(*default_args.as_list())

        conn = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn.open()

        assert dispatcher.connections == [conn]

        conn.on_close()

        assert dispatcher.connections == []

    def test_dispatch_authorized(self, default_args, connection):
        dispatcher = Dispatcher(*default_args.as_list())

        conn1 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn2 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn1.authorized = True
        conn2.authorized = True

        conn1.open()
        conn2.open()

        message = {
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        }

        dispatcher.dispatch(message)

        assert conn1.messages[0] == message
        assert conn2.messages[0] == message

    def test_dispatch_unauthorized(self, default_args, connection):
        dispatcher = Dispatcher(*default_args.as_list())

        conn1 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn2 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn1.open()
        conn2.open()

        dispatcher.dispatch({
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        })

        assert conn1.messages == []
        assert conn2.messages == []

    def test_dispatch_specific(self, default_args, connection):
        dispatcher = Dispatcher(*default_args.as_list())

        conn1 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn2 = connection({
            "add_connection": dispatcher.add_connection,
            "remove_connection": dispatcher.remove_connection,
            "handle_message": dispatcher.handle
        })

        conn1.open()
        conn2.open()

        message = {
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        }

        dispatcher.dispatch(message, connections=[conn2])

        assert conn1.messages == []
        assert conn2.messages[0] == message
