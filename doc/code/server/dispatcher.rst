Asynchronous Communication
==========================

.. automodule:: virtool.dispatcher

Transactions
------------

.. autoclass:: Transaction

    .. autoinstanceattribute:: tid
        :annotation:

    .. autoinstanceattribute:: connection
        :annotation:

    .. autoinstanceattribute:: message
        :annotation:

    .. autoinstanceattribute:: method_name
        :annotation:

    .. autoinstanceattribute:: collection_name
        :annotation:

    .. autoinstanceattribute:: data
        :annotation:

    .. autoinstanceattribute:: response
        :annotation:

    .. autoinstanceattribute:: dispatcher
        :annotation:

    .. automethod:: update

    .. automethod:: fulfill

The Dispatcher
--------------

.. autoclass:: Dispatcher

    .. autoinstanceattribute:: server
        :annotation:

    .. autoinstanceattribute:: settings
        :annotation:

    .. autoinstanceattribute:: connections
        :annotation: = []

    .. autoinstanceattribute:: file_manager
        :annotation:

    .. autoinstanceattribute:: watcher
        :annotation:

Collections
~~~~~~~~~~~

Instances of :class:`database.Collection` are registered with the dispatcher. The
:ref:`exposed methods <exposed-methods>` of each collection are then available to the clients communicating with the
dispatcher and the dispatcher will send changes in the collections to listening clients.

All collection names used by Virtool are listed in the global list variable :attr:`.COLLECTIONS`.

.. autodata:: COLLECTIONS
    :annotation: = []

When registered, collection instances are stored in :attr:`dispatcher.collections`.

.. autoinstanceattribute:: Dispatcher.collections
    :annotation: = {}

Messages
~~~~~~~~

Messages arrive from the client as JSON object. They contain the following fields:

+----------------+-----------------------------------------------------------------------+
| Key            | Description                                                           |
+================+=======================================================================+
| tid            | the id for the transaction, which is unique on the requesting host.   |
+----------------+-----------------------------------------------------------------------+
| methodName     | the name of the exposed method to call.                               |
+----------------+-----------------------------------------------------------------------+
| collectionName | the name of the collection that the exposed method is a member of     |
+----------------+-----------------------------------------------------------------------+
| data           | the data the exposed method should use to do its work                 |
+----------------+-----------------------------------------------------------------------+

The JSON objects are converted to Python dicts by :meth:`.SocketHandler.on_message` and passed to
:meth:`.Dispatcher.handle`.

.. automethod:: Dispatcher.handle

.. autofunction:: handle_future

.. automethod:: Dispatcher.dispatch

Keep Alive
~~~~~~~~~~

The websocket connection will timeout after long period of inactivity. To keep the connection open indefinitely, a ping
message is sent to each connection every ten seconds.

.. automethod:: Dispatcher.ping

Syncing Connections
~~~~~~~~~~~~~~~~~~~

Virtool can produce a large amount of data. It is untenable to send this data to clients every time they load the
application. Instead, the client retains most of the data locally using IndexedDB. When the client loads the
application, a manifest of the local data is sent to the server. If the server data has changed since the last time the
client was loaded, all necessary updates are dispatched to the client to make the client's local data match that on the
server.

.. automethod:: Dispatcher.sync

Listening for File Changes
~~~~~~~~~~~~~~~~~~~~~~~~~~

Some Virtool data directories are watched for changes in real time. These changes are dispatched to clients that are
rendering lists of these files. Clients can actively listen for changes to these files by requesting the exposed methods
described below.

To reduce server disk IO and network traffic, the watchable directories are only watched if at least one client is
listening for changes.

.. automethod:: Dispatcher.listen

.. automethod:: Dispatcher.unlisten

Lifecycle Methods
~~~~~~~~~~~~~~~~~



.. automethod:: Dispatcher.reload

.. automethod:: Dispatcher.shutdown



