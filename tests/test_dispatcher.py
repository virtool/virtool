import pytest

import virtool.api.utils
from virtool.dispatcher import Dispatcher


class TestConnection:

    def test_init(self, test_ws_connection):
        """
        Test that :meth:`.Connection.__init__` draws attributes from the passed session and websocket handler.

        """
        assert test_ws_connection.user_id == "test"
        assert test_ws_connection.groups == ["admin", "test"]
        assert test_ws_connection.permissions == ["create_sample"]

    async def test_send(self, test_ws_connection):
        await test_ws_connection.send({
            "interface": "users",
            "operation": "update",
            "data": {
                "user_id": "john",
                "groups": []
            }
        })

        assert test_ws_connection._ws.send_json.stub.call_args[0] == ({
            'data': {
                'groups': [],
                'user_id': 'john'
            },
            'interface': 'users',
            'operation': 'update'
        }, virtool.api.utils.dumps)

    async def test_close(self, test_ws_connection):
        await test_ws_connection.close()

        assert test_ws_connection._ws.close.stub.called


def test_add_connection(mocker):
    dispatcher = Dispatcher()

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher.connections


def test_remove_connection(mocker):

    dispatcher = Dispatcher()

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher.connections

    dispatcher.remove_connection(m)

    assert dispatcher.connections == []


async def test_dispatch_authorized(create_test_connection):
    """
    Test if an authorized connection can have a message dispatched through it using its ``send`` method.

    """
    dispatcher = Dispatcher()

    m = create_test_connection()

    m.user_id = "test"

    dispatcher.add_connection(m)

    await dispatcher.dispatch("otus", "update", {"test": True})

    m.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": True
        }
    })


async def test_dispatch_unauthorized(create_test_connection):
    """
    Test an unauthorized connections does not have its ``send`` method called during a dispatch.

    """
    dispatcher = Dispatcher()

    m = create_test_connection()

    m.user_id = None

    dispatcher.add_connection(m)

    await dispatcher.dispatch("otus", "update", {"test": True})

    m.send_stub.assert_not_called()


async def test_dispatch_either(create_test_connection):
    """
    Test the only the authorized connection has its ``send`` method called when an one authorized and one
    unauthorized connection are managed by the dispatcher.

    """
    dispatcher = Dispatcher()

    m_authorized = create_test_connection()
    m_authorized.user_id = "test"

    m_unauthorized = create_test_connection()
    m_unauthorized.user_id = None

    dispatcher.add_connection(m_authorized)
    dispatcher.add_connection(m_unauthorized)

    await dispatcher.dispatch("otus", "update", {"test": True})

    m_authorized.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": True
        }
    })

    m_unauthorized.send_stub.assert_not_called()


async def test_dispatch_specific(create_test_connection):
    """
    Test that only the connection passed in the keyword argument ``connections`` has its ``send`` method called when
    a dispatch occurs.

    """
    dispatcher = Dispatcher()

    m_1 = create_test_connection()
    m_1.user_id = "bob"

    m_2 = create_test_connection()
    m_2.user_id = "fred"

    m_3 = create_test_connection()
    m_3.user_id = "test"

    for m in (m_1, m_2, m_3):
        dispatcher.add_connection(m)

    await dispatcher.dispatch("otus", "update", {"test": True}, connections=[m_2])

    m_1.send_stub.assert_not_called()

    m_2.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": True
        }
    })

    m_3.send_stub.assert_not_called()


async def test_callable_filter(create_test_connection):
    """
    Test that the ``conn_filter`` keyword argument properly filters connections and dispatches to them.

    """
    dispatcher = Dispatcher()

    m_1 = create_test_connection()
    m_1.user_id = "bob"

    m_2 = create_test_connection()
    m_2.user_id = "fred"

    dispatcher.add_connection(m_1)
    dispatcher.add_connection(m_2)

    await dispatcher.dispatch("otus", "update", {"test": True}, conn_filter=lambda conn: conn.user_id == "bob")

    m_1.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": True
        }
    })

    m_2.send_stub.assert_not_called()


async def test_non_callable_filter():
    """
    Test that that passing a non-callable ``conn_filter`` keyword argument raises a specific ``TypeError``.

    """
    with pytest.raises(TypeError) as err:
        await Dispatcher().dispatch("otus", "update", {"test": True}, conn_filter=True)

    assert "conn_filter must be callable" in str(err.value)


async def test_callable_modifier(create_test_connection):
    """
    Test that the ``conn_modifier`` keyword argument properly modifies connection objects.

    """
    dispatcher = Dispatcher()

    m_1 = create_test_connection()
    m_1.user_id = "bob"

    m_2 = create_test_connection()
    m_2.user_id = "fred"

    dispatcher.add_connection(m_1)
    dispatcher.add_connection(m_2)

    def apply_male(conn):
        conn.groups = ["men"]

    await dispatcher.dispatch("otus", "update", {"test": True}, conn_modifier=apply_male)

    assert m_1.groups == ["men"]
    assert m_2.groups == ["men"]


async def test_not_callable_modifier():
    """
    Test that an non-callable ``conn_modifier`` raises a specific ``TypeError``.

    """
    with pytest.raises(TypeError) as err:
        await Dispatcher().dispatch("otus", "update", {"test": True}, conn_modifier="abc")

    assert "conn_modifier must be callable" in str(err.value)


async def test_modifier_filter(create_test_connection):
    """
    Test that the ``conn_modifier`` keyword argument only modifies connection objects that pass ``conn_filter``.

    """
    dispatcher = Dispatcher()

    m_1 = create_test_connection()
    m_1.user_id = "bob"
    m_1.groups = None

    m_2 = create_test_connection()
    m_2.user_id = "fred"
    m_2.groups = None

    dispatcher.add_connection(m_1)
    dispatcher.add_connection(m_2)

    def apply_male(conn):
        conn.groups = ["men"]

    await dispatcher.dispatch(
        "otus", "update", {"test": True},
        conn_filter=lambda conn: conn.user_id == "bob",
        conn_modifier=apply_male
    )

    assert m_1.groups == ["men"]
    assert m_2.groups is None


async def test_writer(create_test_connection):
    """
    Test that a writer can properly modify and write a message to the passed connection.

    """
    async def writer(connection, message):
        if connection.user_id == "bob":
            message["data"]["test"] = False

        await connection.send(message)

    dispatcher = Dispatcher()

    m_1 = create_test_connection()
    m_1.user_id = "bob"

    m_2 = create_test_connection()
    m_2.user_id = "fred"

    dispatcher.add_connection(m_1)
    dispatcher.add_connection(m_2)

    await dispatcher.dispatch("otus", "update", {"test": True}, writer=writer)

    m_1.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": False
        }
    })

    m_2.send_stub.assert_called_with({
        "interface": "otus",
        "operation": "update",
        "data": {
            "test": True
        }
    })


async def test_writer_not_callable():
    """
    Test that a writer can properly modify and write a message to the passed connection.

    """
    with pytest.raises(TypeError) as excinfo:
        await Dispatcher().dispatch("otus", "update", {"test": True}, writer="writer")

    assert "writer must be callable" in str(excinfo.value)
