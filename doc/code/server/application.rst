==================
Server Application
==================

.. automodule:: virtool.web

    .. autoclass:: Application

----------------
Development Mode
----------------

The server can be run in development mode by setting the ``development`` parameter when instantiating an
:class:`.Application` object. In development mode, the client files are read from ``./client/dist`` rather than
``./client``. The logging level is also set to ``DEBUG`` when in development mode, whereas it is normally set to
``INFO``.

.. autoinstanceattribute:: Application.development
    :annotation:

.. _periodic-callbacks:

------------------
Periodic Callbacks
------------------

Periodic callbacks are functions that are called every ``interval`` seconds. They are used in Virtool for regularly
checking the contents of a directory or sending ping messages to clients.Tornado implements a handy *class* for doing
this in :class:`tornado.ioloop.PeriodicCallback`.

Virtool provides a easy interface for adding periodic callbacks to the
server. All periodic callbacks added to Virtool are stored in a :class:`list` referenced by the
:attr:`~Application.periodic_callbacks` attribute:

.. autoinstanceattribute:: Application.periodic_callbacks
    :annotation: = []

.. automethod:: Application.add_periodic_callback

-----------------
Lifecycle Methods
-----------------

These methods are used to run and reload the server.

.. automethod:: Application.run

.. automethod:: Application.reload

.. note::
    An interface for shutting down the server is exposed with the :meth:`.Dispatcher.shutdown` method.
    This method directly calls :func:`sys.exit`, terminating the server process.

----------------
Other Attributes
----------------

Single instances of these objects are used for the entire application. They are passed down to child objects. See their
references for further documentation.

.. autoinstanceattribute:: Application.settings
    :annotation:

.. autoinstanceattribute:: Application.dispatcher
    :annotation: