import logging

import virtool.gen
import virtool.utils

logger = logging.getLogger(__name__)


class Collection:

    """
    A proxy for a MongoDB collection. Provides asynchronous access to the collection and dispatches all changes to
    listening clients. Used as a base class to construct proxies for each Mongo collection of interest.

    :param collection_name: the name of the Mongo collection to bind to.
    :type collection_name: str

    :param dispatcher: the dispatcher that instantiated the :class:`~database.Collection` object.
    :type dispatcher: :class:`.Dispatcher`

    """

    def __init__(self, collection_name, dispatcher):

        #: The name of the MongoDB collection that the the :class:`~database.Collection` object is bound to.
        self.collection_name = collection_name

        #: A reference to the dispatcher that instantiated the :class:`~database.Collection` object and will be used to
        #: communicate with clients.
        self.dispatcher = dispatcher

        #: The shared settings object from the :class:`virtool.web.Application` instance.
        self.settings = dispatcher.settings

        #: A :class:`~motor.motor_tornado.MotorCollection` object bound the the
        #: collection specified by :attr:`.collection_name`.
        self.db = virtool.utils.get_db_client(self.settings)[self.collection_name]

        #: A reference to the :meth:`~motor.motor_tornado.MotorCollection.find` method of :attr:`.db`.
        self.find = self.db.find

        #: A reference to the :meth:`~motor.motor_tornado.MotorCollection.find_one` method of :attr:`.db`.
        self.find_one = self.db.find_one

        #: A reference to the :meth:`~motor.motor_tornado.MotorCollection.aggregate` method of :attr:`.db`.
        self.aggregate = self.db.aggregate

        #: This is passed as the search argument for a Mongo find call when getting data for syncing. For instance if to
        #: only sync records with active=True, sync_filter would be set to {"active": True}. By default all records will
        #: be returned.
        self.sync_filter = {}

        #: This projection is used to pare down the output of the result of a call to
        #: :meth:`~motor.motor_tornado.MotorCollection.find` call. By default only the ``_id`` and ``_version`` fields
        #: from each document returned by :meth:`~motor.motor_tornado.MotorCollection.find` will be
        #: returned. The subclass must define a full sync_projector of its own.
        self.sync_projector = {"_version": True, "_id": True}

        logger.debug("Initialized collection " + self.collection_name)

    @virtool.gen.coroutine
    def sync_processor(self, documents):
        """
        Processes a list of projected documents into minimal documents specified for the :class:`~.database.Collection`.
        Intended to be redefined in subclasses of :class:`~.database.Collection`.

        :param documents: a list of documents to process into a list of valid minimal documents for the collection.
        :type documents: list

        :return: valid minimal documents.
        :rtype: list

        """
        return documents

    @virtool.gen.coroutine
    def insert(self, document, connections=None):
        """
        Insert a new document in the collection, dispatching the change to all clients.

        :param document: the data that will form the new document
        :type document: dict

        :param connections: a list of connections to dispatch the message to (None if all)
        :type connections: list

        :return: the response object from MongoDB
        :rtype: dict

        """
        if "_version" not in document:
            document["_version"] = 0

        # Perform the actual database insert operation, retaining the response.
        response = yield self.db.insert(document)

        # Pare down the new document using the sync_projector dict.
        to_dispatch = {key: document[key] for key in self.sync_projector}

        # Run the new document through the collection's sync_processor if it has been defined.
        to_dispatch = yield self.sync_processor([to_dispatch])

        # Dispatch the update to all connected clients.
        yield self.dispatch("update", to_dispatch, connections=connections)

        logger.debug("Inserted new document in collection " + self.collection_name)

        return response

    @virtool.gen.coroutine
    def update(self, query, update, increment_version=True, upsert=False, connections=None):
        """
        Apply an update to a database document.

        :param query: query dictionary or single document id to be passed to MongoDB as a query.
        :type query: str or dict

        :param update: the update that will be passed to MongoDB.
        :type update: dict

        :param increment_version: when ``True``, the _version field is incremented by 1.
        :type increment_version: bool

        :param upsert: perform an upsert when set to True.
        :type upsert: bool

        :param connections: a list of :class:`~.web.SocketHandler` objects to dispatch the update to. If no list is
                            supplied, the update with be dispatched to all connected clients.
        :type connections: list or None

        :return: the MongoDB response object amended with the modified document ids.
        :rtype: dict

        """
        query, multi = coerce_query(query)

        ids_to_update = yield self.find(query, {"_id"}).distinct("_id")

        if increment_version:
            update["$inc"] = {"_version": 1}

        # Perform the update on the database, saving the response.
        response = yield self.db.update(query, update, multi=multi, upsert=upsert)

        # Attach a list of the updated entry_ids to the response. This will be returned by the method.
        response["_ids"] = ids_to_update

        # Get the pared down versions of the updated documents that should be sent to listening clients to update there
        # collections.
        to_dispatch = yield self.find({"_id": {"$in": ids_to_update}}, self.sync_projector).to_list(None)

        # Pass the retrieved documents through the collection's sync_processor if there is one.
        if self.sync_processor:
            to_dispatch = yield self.sync_processor(to_dispatch)

        yield self.dispatch("update", to_dispatch, connections=connections)

        logger.debug("Updated one or more entries in collection " + self.collection_name)

        return response

    @virtool.gen.coroutine
    def remove(self, id_list, connections=None):
        """
        Remove one or more documents from the collection. The provided data dict must contain the key ``_id``.

        :param id_list: the data dict containing ids of documents that should be removed
        :type id_list: list or str

        :param connections: a list of :class:`~.web.SocketHandler` objects to dispatch the removal to. If no list is
                            supplied, the change with be dispatched to all connected clients.
        :type connections: list or None

        :return: the response from MongoDB.
        :rtype: dict

        """
        id_list = coerce_list(id_list)

        # Perform remove operation on database.
        response = yield self.db.remove({"_id": {"$in": id_list}})

        # Dispatch removal notification to all connections.
        yield self.dispatch("remove", id_list, connections=connections)

        # Add a list of removed ids to the response dict and return it.
        response["id_list"] = id_list

        return response

    @virtool.gen.coroutine
    def prepare_sync(self, manifest):
        """
        Prepares to sync the collection to a client with the given manifest. Returns update objects for new or changed
        documents and document ids for removed documents.

        :param manifest: the manifest from the client requesting the sync
        :type manifest: dict

        :return: a tuple containing a list of update objects and a list of document ids to remove
        :rtype: tuple

        """
        cursor = self.find(self.sync_filter, self.sync_projector)

        document_ids = set()

        updates = list()

        while (yield cursor.fetch_next):
            document = cursor.next_object()
            document = yield self.sync_processor([document])
            document = document[0]

            document_ids.add(document["_id"])

            # Is the document id in the manifest?
            in_manifest = document["_id"] in manifest

            # The document has not been created since the client last synced, but has been changed. Send the new
            # version.
            if not in_manifest or (in_manifest and document["_version"] != manifest[document["_id"]]):
                updates.append(document)

            document_ids.add(document["_id"])

        # All remaining documents should be deleted by the client since they no longer exist on the server.
        removes = [document_id for document_id in manifest if document_id not in document_ids]

        return updates, removes

    @virtool.gen.coroutine
    def sync(self, updates, removes, connection):
        """
        Sync documents between the server and client. The client supplies a dictionary of document ids and their version
        numbers. The version numbers are checked against the database and update and remove orders are sent to the
        client accordingly.

        :param updates: a list of update objects to dispatch to the client.
        :type manifest: list

        :param remove: a list of document ids to dispatch to the client, which will tell it which documents to remove.
        :type manifest: list

        :param connection: the connection to dispatch the sync operations to.
        :type connection: :class:`.virtool.web.SocketHandler`

        """
        for i in range(0, len(updates), 10):
            yield self.dispatch("update", updates[i: i + 10], connections=[connection], sync=True)

        # All remaining documents should be deleted by the client since they no longer exist on the server.
        for i in range(0, len(removes), 10):
            yield self.dispatch("remove", removes[i: i + 10], connections=[connection], sync=True)

    @virtool.gen.coroutine
    def dispatch(self, operation, data, collection_name=None, connections=None, sync=False):
        """
        Send a message to listening clients.

        :param operation: the operation that should be performed by the client on its local representation of the data.
        :type operation: str

        :param data: the data payload associated with the operation
        :type data: dict or list

        :param collection_name: override for :attr:`.collection_name`.
        :type collection_name: str

        :param connections: The connections to send the dispatch to. By default, it will be sent to all connections.
        :type connections: list

        """
        # Override the dispatched collection_name if necessary.
        collection_name = collection_name or self.collection_name

        # Dispatch the message via the dispatcher.
        self.dispatcher.dispatch({
            "operation": operation,
            "collection_name": collection_name,
            "data": data,
            "sync": sync
        }, connections)

        return len(coerce_list(data))

    @virtool.gen.coroutine
    def get_new_id(self, excluded=None):
        document_id = yield virtool.utils.get_new_document_id(self.db, excluded)
        return document_id

    @virtool.gen.coroutine
    def get_field(self, query, key):
        """
        Get the value of a field called ``key`` from a single document specified by ``query``.

        :param query: a document id or a query.
        :type query: str or dict

        :param key: the key of the field to return.
        :type key: str

        :return: a document field.
        :rtype: any JSON-compatible type

        """
        query, _ = coerce_query(query)

        document = yield self.find_one(query, {key: True})

        try:
            return document[key]
        except KeyError:
            raise KeyError("Could not find field in entry")
        except TypeError:
            raise ValueError("Could not find entry with given _id")


def coerce_query(query):
    """
    Takes a query dict or a document id and returns a Mongo query and multi boolean. If the input is an id, it will be
    coerced to a query dict of the form {"_id": <document id>}.

    :param query: a query or document id
    :type query: dict or str

    :return: a query dict and multi boolean to supply to a Mongo function.
    :rtype: tuple

    """
    multi = True

    if not isinstance(query, dict):
        query = {"_id": query}
        multi = False

    return query, multi


def coerce_list(obj):
    """
    Takes an object of any type and returns a list. If ``obj`` is a list it will be passed back with modification.
    Otherwise, a single-item list containing ``obj`` will be returned.

    :param obj: an object of any type.
    :type obj: any

    :return: a list equal to or containing ``obj``.
    :rtype: list

    """
    return [obj] if not isinstance(obj, list) else obj