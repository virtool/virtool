.. automodule:: virtool.gen

Special Decorators
==================

Virtool includes several decorators used for simplifying functions and methods that are called as a result of requests
from Websocket clients. Virtool makes heavy use of asynchronous programming using Tornado. All of the decorators in this
module return `Tornado coroutines <http://www.tornadoweb.org/en/stable/coroutine.html>`_.

Coroutines
----------

.. autofunction:: virtool.gen.coroutine


.. _exposed-methods:

Exposed Methods
---------------

Virtool allows clients to modify server state by indirectly calling Python functions on the server. In order to be
called in response to a client request, a function must be decorated by :func:`.exposed_method`. Doing so lets the
:class:`.Dispatcher` instance know that the method is exposed to clients and which permissions are required
for users to call the method.

Every exposed function or method called in response to a client request proceeds in a conserved manner.

1. The Websocket message (request) is received from a client.
2. The message is used to create a :class:`.Transaction` object.
3. The :class:`.Transaction` is passed to the requested server function if the function has been explicitly exposed.
4. The function runs using information in the :class:`.Transaction`.
5. The function completes, fulfilling the :class:`.Transaction`, which is then returned to the requester.

Some of these conserved actions are taken care of by decorating with :func:`.exposed_method`:

.. code-block:: python

    @virtool.gen.exposed_method(["view_record"])
    def view(transaction):
        # Retrieve the record by its record id.
        record = yield get_record(transaction.data["record_id"])

        # The user associated with the requesting connection is readily accessible.
        username = transaction.connection.user["_id"]
        print("Requesting user is {}".format(username))

        # Return a tuple. First item is True because the function call was successful.
        # Second item is the record to be passed to the connection and user that made
        # the request.
        return True, record

In the example, the :func:`.exposed_method` decorator makes the function `view` available for clients to call through the
:class:`.Dispatcher`. The permission *view_record* must be present in the calling user's permissions list for the call
to succeed. The *record_id* is passed to the function in the :class:`.Transaction` object.

The request connection is also available in the transaction as well as the user associated with the connection. The
decorated function **must** return a tuple containing of a :class:`bool` and a :class:`dict` or :class:`list`. Returning
these values fulfills the transaction with the client and lets it know if the request was successful and if any data was
returned by the function call. In the example, the *record* is returned to the client.

.. _protected-methods:

The ``unprotected`` keyword argument can be set to ``True`` in :func:`.exposed_method` to allow unauthorized connections
to call the decorated method. This is useful for methods involved in user authentication.

.. autofunction:: virtool.gen.exposed_method

Thread Pool
-----------

When :mod:`virtool.gen` is imported, a :class:`concurrent.futures.ThreadPoolExecutor` object is created that can be
used to run synchronous functions in a separate thread of control. A future is returned when the function is submitted
to the thread pool. Yielding the future returns the result of the synchronous function once it completes.

.. autodata:: virtool.gen.THREAD_POOL

    This 10-worker thread pool is created when the :mod:`virtool.gen` module is imported. All functions decorated
    with :func:`.synchronous` are run in one of the threads in the pool. Implements
    :class:`~concurrent.futures.ThreadPoolExecutor`.


The decorator :func:`.synchronous` makes this simple returning a coroutine where the decorated function is submitted
to :data:`~.THREAD_POOL` and future is returned which is fulfilled when the function returns.

.. autofunction:: virtool.gen.synchronous