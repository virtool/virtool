import json
import traceback
import logging
import tornado.concurrent
import tornado.websocket
import tornado.gen
import tornado.ioloop

import virtool.gen
import virtool.jobs
import virtool.samples
import virtool.viruses
import virtool.history
import virtool.indexes
import virtool.hosts
import virtool.users
import virtool.groups
import virtool.gen
import virtool.files

#: The names of all collections registered with the dispatcher.
COLLECTIONS = [
    "jobs",
    "samples",
    "viruses",
    "hmm",
    "history",
    "indexes",
    "hosts",
    "groups",
    "users"
]

logger = logging.getLogger(__name__)


class Dispatcher:

    """
    Handles all websocket communication with clients. New :class:`.Transaction` objects are generated from incoming
    messages and passed to :ref:`exposed methods <exposed-methods>`. When exposed methods return, the transactions are
    fulfilled and returned to the client.

    The dispatcher also instantiates most of Virtool's :class:`~.database.Collection` subclasses, an instance of
    :class:`.files.Manager`, and an instance of :class:`.files.Watcher`.

    """
    def __init__(self, server):
        #: A reference to the server that instantiated the :class:`.Dispatcher` object and is the parent object of the
        #: dispatcher.
        self.server = server

        #: The shared :class:`~.virtool.settings.Settings` object created by the server. Passed to all collections.
        self.settings = server.settings

        #: A :class:`~.virtool.files.Watcher` object that keeps track of what files are in the watch folder and host
        #: FASTA folder and sends changes to listening clients.
        self.watcher = virtool.files.Watcher(self)

        #: An instance of :class:`virtool.files.Manager`. Used for managing uploads and downloads.
        self.file_manager = virtool.files.Manager(self.server)

        #: A dict containing all :class:`~.database.Collection` objects available on the server, with their
        #: ``collection_name`` attributes as keys.
        self.collections = {module: getattr(virtool, module).Collection for module in COLLECTIONS}

        # Instantiate all the Collection objects.
        if self.settings.get("server_ready"):
            for collection_name in COLLECTIONS:
                self.collections[collection_name] = self.collections[collection_name](self)

        # Add self.settings to the collections dict so its methods can be exposed through the dispatcher.
        self.collections["settings"] = self.settings

        #: A list of all active connections (:class:`.SocketHandler` objects).
        self.connections = list()

        # Calls the ping method on the next IOLoop iteration.
        self.server.add_periodic_callback(self.ping, 10000)

    def handle(self, message, connection):
        """
        Handles all inbound messages from websocket clients.

        Generates a new :class:`.Transaction` object bound to the transaction id included in the message. The
        transaction will be assigned as attributes the collection name and exposed method name from the transaction.
        A reference to the requesting :class:`.SocketHandler` object is also assigned to the transaction's
        :attr:`~.Transaction.connection` attribute.

        An attempt is made to call the method identified by the ``collection_name`` and ``method_name`` fields from the
        message. Warnings are logged when:

        - the collection identified by ``collection_name`` does not exist
        - the method identified by ``method_name`` does not exist
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
        transaction = Transaction(self, connection, message)

        # Log a string of the format '<username> (<ip>) request <collection>:<method>' to describe the request.
        logger.info('{} ({}) requested {}.{}'.format(
            connection.user["_id"],
            connection.ip,
            transaction.collection_name,
            transaction.method_name
        ))

        # Get the requested collection if possible, otherwise log warning and return.
        try:
            collection = self.collections[transaction.collection_name]
        except KeyError:
            if transaction.collection_name == "dispatcher":
                collection = self
            else:
                logger.warning("User {} specified unknown collection {}".format(
                    connection.user["_id"],
                    transaction.collection_name
                ))
                return False

        # Get the requested method if possible, otherwise log warning and return.
        try:
            method = getattr(collection, transaction.method_name)
        except AttributeError:
            logger.warning("User {} attempted unknown request {}.{}".format(
                connection.user["_id"],
                transaction.collection_name,
                transaction.method_name
            ))
            return False

        # Log warning and return if method is not exposed.
        if not hasattr(method, "is_exposed") or not method.is_exposed:
            logger.warning("User {} attempted to call unexposed method {}.{}".format(
                connection.user["_id"],
                transaction.collection_name,
                transaction.method_name
            ))
            return False

        if not connection.authorized and not method.is_unprotected:
            logger.warning("Unauthorized connection at {} attempted to call protected method {}.{}".format(
                connection.ip,
                transaction.collection_name,
                transaction.method_name
            ))
            return False

        # Call the exposed method if it is unprotected or the requesting connection has been authorized.
        if connection.authorized or method.is_unprotected:
            call_succeeded = True

            result = None

            try:
                result = method(transaction)
            except TypeError:
                call_succeeded = False

            if not call_succeeded:
                result = method()

            assert result

            if isinstance(result, tornado.concurrent.Future):
                self.server.loop.add_future(result, handle_future)

        return True

    def dispatch(self, message, connections=None):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``
        (:class:`.SocketHandler` objects). Messages are dicts with the scheme:

        +----------------+-----------------------------------------------------------------------+
        | Key            | Description                                                           |
        +================+=======================================================================+
        | operation      | a word used to tell the client what to do in response to the message. |
        +----------------+-----------------------------------------------------------------------+
        | collectionName | the name of the collection the client should perform the operation on |
        +----------------+-----------------------------------------------------------------------+
        | data           | test                                                                  |
        +----------------+-----------------------------------------------------------------------+

        :param message: the message to dispatch
        :type message: dict or list

        :param connections: the connection(s) (:class:`.SocketHandler` objects) to dispatch the message to.
        :type connections: list

        """
        base_message = {
            "operation": None,
            "collection_name": None,
            "data": None
        }

        base_message.update(message)

        # If the connections parameter was not set, dispatch the message to all authorized connections.
        connections = connections or filter(lambda conn: conn.authorized, self.connections)

        # Send the message to all appropriate websocket clients.
        for connection in connections:
            connection.write_message(base_message)

    @virtool.gen.coroutine
    def ping(self):
        """
        Sends a ping message to the client to keep the connection alive. Added as a periodic callback using
        :meth:`.Application.add_periodic_callback` as soon as the dispatcher is created. Called every three seconds.

        """
        self.dispatch({
            "operation": "ping",
            "collection": None,
            "data": None
        })

    @virtool.gen.exposed_method([])
    def listen(self, transaction):
        """
        Listen to file updates associated with the watcher name passed in the transaction.

        :param transaction: the transaction generated by the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating success and ``None``.
        :rtype: tuple

        """
        for file_document in self.watcher.files[transaction.data["name"]].values():
            self.dispatch({
                "operation": "update",
                "collection_name": transaction.data["name"],
                "data": file_document,
                "sync": True
            }, [transaction.connection])

        self.watcher.add_listener(transaction.data["name"], transaction.connection)

        return True, None

    @virtool.gen.exposed_method([])
    def unlisten(self, transaction):
        """
        Stop listening to file updates associated with the watcher name passed in the transaction.

        :param transaction: the transaction generated by the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating success and ``None``.
        :rtype: tuple

        """
        self.watcher.remove_listener(transaction.connection, name=transaction.data["name"])

        return True, None

    @virtool.gen.exposed_method(["modify_options"])
    def reload(self):
        """
        Reload the server by calling :meth:`.Application.reload`. See that method's documentation for more information.

        :return: a boolean indicating success and ``None``.
        :rtype: tuple

        """
        yield self.server.reload()

        return True, None

    @virtool.gen.exposed_method(["modify_options"])
    def shutdown(self):
        """
        Shutdown the server by calling :func:`sys.exit` with an exit code of 0.

        """
        yield self.server.shutdown(0)


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
    def __init__(self, dispatcher, connection, message):

        #: The raw message from the client converted to dict from JSON.
        self.message = json.loads(message)

        #: The :class:`.SocketHandler` object to send a reply through. If it is set to None, the message will be
        #: broadcast.
        self.connection = connection

        #: The dispatcher that spawned the transaction. Referred to for broadcasting a result to all registered
        #: connections
        self.dispatcher = dispatcher

        #: The :abbr:`TID (transaction ID)` generated for the transaction by the requesting client.
        self.tid = self.message["tid"]

        try:
            #: The name of the exposed method to call.
            self.method_name = self.message["methodName"]
        except KeyError:
            raise KeyError("Message dict used to create Transaction must contain methodName key.")

        #: The name of the collection or object containing the exposed method to call.
        self.collection_name = self.message["collectionName"] if "collectionName" in self.message else None

        #: The data to be used for calling the exposed method.
        self.data = self.message["data"] if "data" in self.message else None

        #: An attribute that can be reassigned to send data to the client when the transaction is fulfilled without
        #: passing data directly to :meth:`.fulfill`.
        self.response = None

    def fulfill(self, success=True, data=None):
        """
        Called when the exposed method specified by :attr:`.method_name` returns. Sends a message to the client telling
        it whether the transaction was successful and sending any data returned by the exposed method.

        :param success: indicates whether the transaction succeeded.
        :type success: bool

        :param data:
        :type data: dict or list

        """
        data = data or self.response

        if not success:
            data_to_send = {
                "warning": True,
                "message": "Error"
            }

            if data:
                data_to_send.update(data)

            data = data_to_send

        self.dispatcher.dispatch({
            "collection_name": "transaction",
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
        self.dispatcher.dispatch({
            "collection_name": "transaction",
            "operation": "update",
            "data": {
                "tid": self.tid,
                "data": data
            }
        }, [self.connection])


def handle_future(future):
    """
    Handle a future by returning its result or printing any exception that occurred during its execution. Used when
    coroutines are called outside of another coroutine and are not ``yielded``.

    :param future: the future to handle
    :type future: :class:`tornado.concurrent.future`

    """
    try:
        future.result()
    except Exception:
        print(traceback.format_exc())
