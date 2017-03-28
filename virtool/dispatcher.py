import json
import logging
import warnings


logger = logging.getLogger(__name__)


class Dispatcher:

    def __init__(self, add_periodic_callback):

        self.add_periodic_callback = add_periodic_callback

        self.interfaces = dict()
        self.collections = dict()

        #: A list of all active connections (:class:`.SocketHandler` objects).
        self.connections = list()

        # Calls the ping method on the next IOLoop iteration.
        add_periodic_callback(self.ping, 10000)

    def add_interface(self, name, interface_class, settings, is_collection=False, args=None):
        """
        Add an interface to the dispatcher. It will be available in ``self.interfaces`` with the key ``name``. If the
        interface is a collection, it will also be referenced in ``self.collections``.

        Raises and exception if an interface has already been added with the passed name.

        Issues a warning if the passed ``obj`` has no exposed methods.

        :param name: the name to store the interface under.
        :type name: str

        :param interface_class: the class that will be used to create the interface object
        :type interface_class: class

        :param settings: the settings object the collection should use
        :type settings: :class:`.settings.Settings`

        :param is_collection: a flag indicating whether the interface is a collection
        :type is_collection: bool

        :param extra: extra attributes to set on the interface object.
        :type extra: dict

        """
        if name in self.interfaces:
            raise ValueError("Dispatcher already has interface with name '{}'".format(name))

        attr_list = [getattr(interface_class, attr) for attr in dir(interface_class)]

        if not any(hasattr(attr, "is_exposed") for attr in attr_list):
            warnings.warn(Warning("Passed interface '{}' has no exposed methods".format(name)))

        if not args:
            args = []

        interface = interface_class(
            self.dispatch,
            self.collections,
            settings,
            self.add_periodic_callback,
            *args
        )

        self.interfaces[name] = interface

        if is_collection:
            self.collections[name] = interface

    def add_connection(self, connection):
        """
        Add a connection to the dispatcher so interfaces can write messages to it.

        :param connection: the connection to add.
        :type connection: :class:`.SocketHandler`

        """
        for method_name in ["open", "on_message", "on_close", "write_message"]:
            try:
                # Make sure the passed connection has the methods necessary for it to function properly.
                method = getattr(connection, method_name)
                assert callable(method)
            except (AttributeError, AssertionError):
                raise AttributeError("Connection must have method '{}'".format(method_name))

        self.connections.append(connection)

    def remove_connection(self, connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.

        :param connection: the connection to remove
        :type connection: :class:`.SocketHandler`

        """
        try:
            connection.close()
        except tornado.websocket.WebSocketClosedError:
            pass

        try:
            self.connections.remove(connection)
        except ValueError:
            pass

    @virtool.gen.coroutine
    def handle(self, message, connection):
        """
        Handles all inbound messages from websocket clients.

        Generates a new :class:`.Transaction` object bound to the transaction id included in the message. The
        transaction will be assigned as attributes the collection name and exposed method name from the transaction.
        A reference to the requesting :class:`.SocketHandler` object is also assigned to the transaction's
        :attr:`~.Transaction.connection` attribute.

        An attempt is made to call the method identified by the ``interface`` and ``method`` fields from the message.
        Warnings are logged when:

        - the interface identified by ``interface`` does not exist
        - the method identified by ``method`` does not exist
        - the method is not :ref:`exposed <exposed-methods>`
        - the method is :ref:`protected <protected-methods>` and the user is not authorized

        :param message: a message from a connected client.
        :type message: dict

        :param connection: the connection that received the message.
        :type connection: :class:`.web.SocketHandler`

        :return: ``True`` if the message was handled successfully, ``False`` otherwise
        :rtype: bool

        """
        # Create a transaction based on the message.
        transaction = Transaction(self.dispatch, message, connection)

        # Log a string of the format '<username> (<ip>) request <interface>:<method>' to describe the request.
        logger.info('{} requested {}.{}'.format(
            gen_log_prefix(connection),
            transaction.interface,
            transaction.method
        ))

        # Get the requested interface object if possible, otherwise log warning and return.
        try:
            interface = self.interfaces[transaction.interface]
        except KeyError:
            logger.warning("{} requested unknown interface {}".format(
                gen_log_prefix(connection),
                transaction.interface
            ))
            return False

        # Get the requested method if possible, otherwise log warning and return.
        try:
            method = getattr(interface, transaction.method)
        except AttributeError:
            logger.warning("{} requested unknown interface method {}.{}".format(
                gen_log_prefix(connection),
                transaction.interface,
                transaction.method
            ))
            return False

        # Log warning and return if method is not exposed.
        if not hasattr(method, "is_exposed") or not method.is_exposed:
            logger.warning("{} attempted to call unexposed method {}.{}".format(
                gen_log_prefix(connection),
                transaction.interface,
                transaction.method
            ))
            return False

        is_unprotected = hasattr(method, "is_unprotected")

        if not connection.authorized and not is_unprotected:
            logger.warning("Unauthorized connection at {} attempted to call protected method {}.{}".format(
                connection.ip,
                transaction.interface,
                transaction.method
            ))
            return False

        # Call the exposed method if it is unprotected or the requesting connection has been authorized.
        if connection.authorized or is_unprotected:
            try:
                # Exposed methods most commonly take the transaction as the sole argument (positional).
                yield method(transaction)

            except virtool.gen.RequiredPermissionError as inst:
                logger.warning(str(inst.args[0]))
                return False

            except TypeError as inst:
                if "takes 1 positional argument but" in inst.args[0]:
                    raise TypeError("Exposed method '{}' must take a transaction as its single argument".format(
                        getattr(method, "__name__")
                    ))

                raise

        return True

    def dispatch(self, message, connections=None, conn_filter=None, conn_modifier=None, writer=None):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``
        (:class:`.SocketHandler` objects). Messages are dicts with the scheme:

        +----------------+-----------------------------------------------------------------------+
        | Key            | Description                                                           |
        +================+=======================================================================+
        | operation      | a word used to tell the client what to do in response to the message. |
        +----------------+-----------------------------------------------------------------------+
        | interface      | the name of the interface the client should perform the operation on  |
        +----------------+-----------------------------------------------------------------------+
        | data           | test                                                                  |
        +----------------+-----------------------------------------------------------------------+

        :param message: the message to dispatch
        :type message: dict or list

        :param connections: the connection(s) (:class:`.SocketHandler` objects) to dispatch the message to.
        :type connections: list

        :param conn_filter: filters the connections to which messages are written.
        :type conn_filter: callable

        :param conn_modifier: modifies the connection objects to which messages are written.
        :type conn_modifier: callable

        :param writer: modifies the written message based on the connection.
        :type writer: callable

        """
        to_send = {
            "operation": None,
            "interface": None,
            "data": None
        }

        to_send.update(message)

        # If the connections parameter was not set, dispatch the message to all authorized connections.
        connections = connections or [conn for conn in self.connections if conn.authorized]

        if conn_filter:
            if not callable(conn_filter):
                raise TypeError("conn_filter must be callable")

            connections = [conn for conn in connections if conn_filter(conn)]

        if conn_modifier:
            if not callable(conn_modifier):
                raise TypeError("conn_modifier must be callable")

            for connection in connections:
                conn_modifier(connection)

        if writer:
            if not callable(writer):
                raise TypeError("writer must be callable")

            for connection in connections:
                writer(connection, dict(to_send))

            return

        for connection in connections:
            connection.write_message(message)

    @virtool.gen.coroutine
    def ping(self):
        """
        Sends a ping message to the client to keep the connection alive. Added as a periodic callback using
        :meth:`.Application.add_periodic_callback` as soon as the dispatcher is created. Called every three seconds.

        """
        self.dispatch({
            "operation": "ping",
            "interface": None,
            "data": None
        })

        return "test"


class Transaction:

    """
    Transactions represent websocket exchanges between the client and server. When a message is received,
    :meth:`Dispatcher.handle` is called, immediately generating a new :class:`.Transaction` object. The
    `exposed method <exposed-method>`_ requested by the client is then called and passed the transaction as the sole
    parameter.

    While the `exposed method <exposed-method>`_ is executing, it can send updates for the transaction by calling
    :meth:`Transaction.update` with data that should be sent to the client.

    When the `exposed method <exposed-method>`_ completes, it **must** return return a tuple containing a boolean
    indicating whether the operation was successful and any data that should be returned to the requesting client. The
    return value will be used to call :meth:`.Transaction.fulfill` and send the result to the requesting client.

    The transaction is identified by a transaction ID (TID) generated by the client. When it is fulfilled and returned
    to the client, the client can identify the transaction by its :abbr:`TID (transaction ID)` and call any functions
    bound to success or failure of the request.

    """
    def __init__(self, dispatch, message, connection):

        #: The raw message from the client converted to dict from JSON.
        self.message = json.loads(message)

        #: The :class:`.SocketHandler` object to send a reply through. If it is set to None, the message will be
        #: broadcast.
        self.connection = connection

        self.dispatch = dispatch

        #: The :abbr:`TID (transaction ID)` generated for the transaction by the requesting client.
        try:
            self.tid = self.message["tid"]
            assert isinstance(self.tid, int)
        except KeyError:
            raise KeyError("Received message has no TID")
        except AssertionError:
            raise TypeError("TID must be an instance of int")

        self.method = self.message.get("method", None)

        #: The name of the interface or object containing the exposed method to call.
        self.interface = self.message.get("interface", None)

        #: The data to be used for calling the exposed method.
        self.data = self.message.get("data", None)

        #: An attribute that can be reassigned to send data to the client when the transaction is fulfilled without
        #: passing data directly to :meth:`.fulfill`.
        self.response = None

    def fulfill(self, success=True, data=None):
        """
        Called when the exposed method specified by :attr:`.method` returns. Sends a message to the client telling
        it whether the transaction was successful and sending any data returned by the exposed method.

        :param success: indicates whether the transaction succeeded.
        :type success: bool

        :param data:
        :type data: dict or list

        """
        data = data or self.response

        if not success and not data:
            data = {
                "message": "Error"
            }

        self.dispatch({
            "interface": "transaction",
            "operation": "fulfill",
            "data": {
                "tid": self.tid,
                "success": success,
                "data": data
            }
        }, [self.connection])

    def update(self, data):
        """
        Sends an update that is tied to the transaction to the requesting client. Useful for giving progress updates.

        :param data: data to send to the client
        :type data: any

        """
        self.dispatch({
            "interface": "transaction",
            "operation": "update",
            "data": {
                "tid": self.tid,
                "data": data
            }
        }, [self.connection])


def gen_log_prefix(connection):
    return "{} ({})".format(
        connection.user["_id"] or "<unauthorized>",
        connection.ip
    )
