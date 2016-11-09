Database
========

All user interaction with the MongoDB database that backs Virtool is performed through instances of
:class:`~.database.Collection`, which represent interfaces with single MongoDB collections. Any inserts, updates, or
deletions performed using the interface are broadcast to all clients connected unless specifically prevented.


Introduction
------------

In Virtool, most database documents are available to the user in two ways.

A complete set of documents is maintained in IndexedDB on the client side using LokiJS. All changes to the server
database registered on the server are sent to connected client so they can keep their information update-to-date. The
documents maintained on the client are not complete. To maintain speed of communication and keep client storage
requirements reasonable, the documents are pared down to *minimal documents* that contain only essential information.

The :ref:`exposed method <exposed-methods>` called detail for each collection is used to return the entire document to
a client on request.


Syncing
-------

The process for maintaining matching document sets between the server and clients is called *syncing*. Manifests of
document ids and versions for each client-side collection are sent to the server. These are passed to
:meth:`.Collection.prepare_sync` which calculates a list of updates that should be applied
by the client and a list of documents that should be removed by the client. The actual syncing is performed by the
:meth:`.Collection.sync`.

Sync is passed a manifest of documents possessed by the client. The manifest is a :class:`dict` of document versions
keyed by their ids. Sync can do four different things for each document considered:

1. **Document is in the manifest but not on the server** - tell client to remove document.
2. **Document has newer version on the server** - send an update to the client.
3. **Document is on the server but not in the manifest** - send a new document for the client to insert.
4. **Document versions match on server and client** - do nothing.

Any new document or update that is passed to the client is a minimal document. Several measures are used to generate
minimal documents. First, we take advantage of of the :meth:`~.pymongo.collection.Collection.find` method from Pymongo
and Motor. Calls to this method have the following form:

.. code-block:: python

    documents = Collection.find(spec, fields)

The argument ``spec`` is a JSON object that specifies conditions under which documents can be included in the result
set. For example:

.. code-block:: python

    # Only returns documents where the `archived` field is True.
    documents = Collection.find({"archived": True})

The fields returned in the results can be specified using the ``fields`` argument. For example:

.. code-block:: python

    # Only returns documents where the `archived` field is True. Excludes all fields but `name`
    # and `_id` from the returned documents. The `_id` field is always included unless
    # specifically excluded.
    documents = Collection.find({"archived": True}, {"name": True})

For syncing in Virtool, the attributes :attr:`.sync_filter` and :attr:`.sync_projector` directly map to the ``spec`` and
``fields`` arguments. This allows the collection to reliably sync minimal documents that match the :attr:`sync_filter`
and contain only the fields specified in :attr:`.sync_projector`.

Final modifications can be made to minimal documents using :meth:`~.database.Collection.sync_processor` method. It takes
a list of minimal documents, makes final changes, and returns the processed documents to be dispatched to the clients.
By default, :meth:`~.database.Collection.sync_processor` makes no changes to passed documents. It is intended to be
redefined by classes extending :class:`~.database.Collection`.


Operations
----------

The database is modified using the methods :meth:`~.database.Collection.insert`, :meth:`~.database.Collection.update`,
and :meth:`~.database.Collection.remove` implemented in the :class:`~.database.Collection`.

These methods are essentially wrappers for :class:`~motor.motor_tornado.MotorCollection` methods with the same names.
These wrappers take care of dispatching their changes to clients and incrementing document versions when updates are
made.


Collections
-----------

Collection objects are interfaces for modifying and viewing Mongo documents. They are extended in Virtool to also
monitor and dispatch changes in files and manage running jobs.

.. automodule:: virtool.database

    .. autoclass:: Collection

        .. autoinstanceattribute:: collection_name
            :annotation:

        .. autoinstanceattribute:: dispatcher
            :annotation:

        .. autoinstanceattribute:: settings
            :annotation:

        .. autoinstanceattribute:: db
            :annotation:

        .. autoinstanceattribute:: find
            :annotation:

        .. autoinstanceattribute:: find_one
            :annotation:

        .. autoinstanceattribute:: aggregate
            :annotation:

        .. autoinstanceattribute:: sync_filter
            :annotation: = {}

        .. autoinstanceattribute:: sync_projector
            :annotation: = {"_version": True, "_id": True}

        .. automethod:: sync_processor

        .. automethod:: sync

        .. automethod:: insert

        .. automethod:: update

        .. automethod:: remove

        .. automethod:: dispatch

        .. automethod:: get_new_id

        .. automethod:: get_field


Utility Functions
-----------------

.. autofunction:: virtool.database.coerce_query

.. autofunction:: virtool.database.coerce_list