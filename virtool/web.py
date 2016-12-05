import os
import sys
import ssl
import logging
import subprocess
import importlib
import tornado.web
import tornado.gen
import tornado.ioloop
import tornado.escape
import tornado.websocket
import tornado.httpserver

import virtool.setup
import virtool.settings
import virtool.dispatcher
import virtool.gen

logger = logging.getLogger(__name__)


class Application:

    """
    The server application.

    :param development: When ``True``, the server uses the development client file path and logs debug messages.
    :type development: bool

    """

    def __init__(self, development=False):

        self.version = find_server_version()

        logger.info("Starting Virtool " + self.version)

        #: Set to ``True`` when the server is running in development mode.
        self.development = development

        #: A reference to global instance of :class:`tornado.ioloop.IOLoop`.
        self.loop = None

        #: The server :class:`tornado.web.Application` object.
        self.app = None

        #: The global :class:`.Dispatcher` object used to communicate with clients.
        self.dispatcher = None

        #: The global :class:`.Settings` object used to read and write the settings file and send and receive settings
        #: changes to and from clients.
        self.settings = None

        #: A list of :class:`~tornado.ioloop.PeriodicCallback` objects. The list is populated by calling
        #: :meth:`.add_periodic_callback`. Keeping references to these periodic callbacks allows them to be stopped if
        #: necessary.
        self.periodic_callbacks = list()

        self.ssl = None
        self.host = None
        self.port = None

        self.server_object = None

    def run(self):
        """
        Start the server application. This method must be called before the server can respond to client requests. In
        order, this method:

        1. Creates a :class:`.Settings` object. This will write a new 'settings.json' if none is present.
        2. Creates a :class:`.Dispatcher` object if the server has been setup and the ``server_ready`` setting is
           ``True``.
        3. Determines the path to the client files based on the value of the :attr:`.development` attribute.
        4. Populates a list of request handlers.
        5. Instantiates the :class:`~tornado.web.Application` object with the handlers defined earlier.
        6. Starts listening at the set address, using SSL if enabled.
        7. Creates and starts a :class:`tornado.ioloop.IOLoop`.

        See

        """
        # Create a Settings object because it is required whether the server has been setup or not. Will write a default
        # 'settings.json' file if none is found.
        self.settings = virtool.settings.Settings(self)

        self.settings.data["server_version"] = self.version

        self.ssl = self.settings.get("use_ssl")
        self.host = self.settings.get("server_address")
        self.port = self.settings.get("server_port")


        if self.settings.get("server_ready"):
            # Create a dispatcher object only if the server has been setup and the 'server_ready' settings has been set
            # to True.
            self.dispatcher = virtool.dispatcher.Dispatcher(self)
            logger.debug("Instantiated dispatcher")
        else:
            logger.info("Server has not been setup.")

        # Define the path where the server will look for the client HTML file. Path depends on the value of the
        # development attribute.
        static_path = "client/dist/" if self.development else "client/"

        if self.development and not os.path.isfile(os.path.join("client/dist/index.html")):
            static_path = "client/"

        logger.debug("Client HTML path is " + static_path)

        # Define the path where the server will look for the documentation files.
        doc_path = "doc/_build/html/" if self.development else "doc"
        logger.debug("Documentation path is " + doc_path)

        # Setup static handlers and handler classes defined in this module.
        handlers = [
            (r"/", HTTPHandler),
            (r"/ws", SocketHandler),
            (r"/upload", UploadHandler),
            (r"/download/(.*)", tornado.web.StaticFileHandler, {"path": self.settings.get("data_path") + "/download/"}),
            (r"/doc/(.*)", tornado.web.StaticFileHandler, {"path": doc_path}),
            (r"/(app.*js$|favicon.ico)", tornado.web.StaticFileHandler, {"path": static_path})
        ]

        # Create application object. All responses are compressed and a reference to this object is made available to
        # all request handlers.
        self.app = tornado.web.Application(
            handlers,
            compress_response=True,
            server=self
        )

        try:
            ssl_ctx = None

            ssl_cert_path = self.settings.get("cert_path")
            ssl_key_path = self.settings.get("key_path")

            # Setup SSL if necessary.
            if self.settings.get("use_ssl") and ssl_cert_path and ssl_key_path:
                ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                ssl_ctx.load_cert_chain(ssl_cert_path, ssl_key_path)

            # Try to start the application. If the set address and port cannot be bound, an error is logged and the
            # program exits with an return code of 1. X-headers are enabled for future implementation of SSL.
            self.server_object = self.app.listen(
                self.settings.get("server_port"),
                self.settings.get("server_address"),
                xheaders=bool(ssl_ctx),
                ssl_options=ssl_ctx
            )

            # Log a message if the server binds successfully.
            logger.info("Listening on {}:{}".format(
                self.settings.get("server_address"), str(self.settings.get("server_port"))
            ))
        except PermissionError:
            logger.critical("Could not bind address {}:{}".format(
                self.settings.get("server_address"),
                self.settings.get("server_port")
            ))

            sys.exit(1)

        # Create IOLoop object and start it.
        logger.debug("Starting IOLoop.")
        self.loop = tornado.ioloop.IOLoop.instance()

        try:
            logger.debug("Starting IOLoop.")
            self.loop.start()
        except KeyboardInterrupt:
            self.handle_interrupt()


        # When the IOLoop.start() method returns, close the IOLoop.
        self.loop.close()
        logger.debug("Closed IOLoop.")

    def add_periodic_callback(self, func, interval=500):
        """
        Add a periodic callback that will be called every ``interval`` milliseconds. A
        :class:`~tornado.ioloop.PeriodicCallback` object with the passed interval is created for each added ``func`` and
        stored in :attr:`.periodic_callbacks`. Its :meth:`~tornado.ioloop.PeriodicCallback.start` method is called
        immediately.

        :param func: the function to call as a callback.
        :type func: function

        :param interval: time in milliseconds between calls.
        :type interval: int

        """
        # Add the callback to the IOLoop.
        periodic_callback = tornado.ioloop.PeriodicCallback(func, interval)

        # Add a reference to the so it can be stopped later if necessary.
        self.periodic_callbacks.append(periodic_callback)

        periodic_callback.start()

    @virtool.gen.coroutine
    def reload(self):
        """
        Reloads the server by:

        * stopping all periodic callbacks
        * reloading all Virtool modules
        * reloading settings
        * starting the dispatcher if the setting ``server_ready`` is True.

        """
        logger.info("Reloading server")

        logger.debug("Stopping all periodic callbacks.")
        for periodic_callback in self.periodic_callbacks:
            periodic_callback.stop()

        logger.debug("Reloading Virtool modules")
        for module in [virtool.setup, virtool.settings, virtool.dispatcher]:
            importlib.reload(module)


        logger.debug("Reloading settings")
        self.settings = virtool.settings.Settings(self)

        # Re-instantiate the dispatcher if the "server_ready" setting is ``True``.
        if self.settings.get("server_ready"):
            logger.debug("Instantiating dispatcher")
            self.dispatcher = virtool.dispatcher.Dispatcher(self)

        # Listen on a new address if the "server_port" or "server_address" settings were changed since the last start.
        if (self.host != self.settings.get("server_address") or
            self.port != self.settings.get("server_port") or
            self.ssl != self.settings.get("use_ssl")):

            self.server_object.stop()

            self.ssl = self.settings.get("use_ssl")
            self.host = self.settings.get("server_address")
            self.port = self.settings.get("server_port")

            ssl_ctx = None

            ssl_cert_path = self.settings.get("cert_path")
            ssl_key_path = self.settings.get("key_path")

            # Setup SSL if necessary.
            if self.settings.get("use_ssl") and ssl_cert_path and ssl_key_path:
                ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
                ssl_ctx.load_cert_chain(ssl_cert_path, ssl_key_path)

            # Try to start the application. If the set address and port cannot be bound, an error is logged and the
            # program exits with an return code of 1. X-headers are enabled for future implementation of SSL.
            self.server_object = self.app.listen(
                self.settings.get("server_port"),
                self.settings.get("server_address"),
                xheaders=bool(ssl_ctx),
                ssl_options=ssl_ctx
            )

    def handle_interrupt(self, *args):
        future = self.shutdown(130)
        self.loop.add_future(future, virtool.dispatcher.handle_future)

    @tornado.gen.coroutine
    def shutdown(self, exit_code=0):
        """
        Shutdown the server by cancelling all jobs and calling :func:`sys.exit`.

        :param exit_code: the exit code to return.
        :type exit_code: int

        """
        logging.info("Shutting down")

        if self.dispatcher:
            id_list = list(self.dispatcher.collections["jobs"].jobs_dict.keys())
            yield self.dispatcher.collections["jobs"]._cancel(id_list)

        timed = 0

        while len(self.dispatcher.collections["jobs"].jobs_dict) > 0 and timed < 5:
            yield tornado.gen.sleep(1)
            timed += 1

        if timed == 5:
            logging.critical("Timed out waiting for jobs to cancel")
            exit_code = 1

        logging.info("Exiting")

        sys.exit(exit_code)


class HTTPHandler(tornado.web.RequestHandler):
    """
    Serves the client application files including HTML template, CSS, and JS. On loading the JS files, the
    client will initiate a web socket connection with the server and all following data exchange will occur
    through this connection.

    This handler is also used for setting up Virtool for the first time using
    `AJAX <https://en.wikipedia.org/wiki/Ajax_(programming)>`_ requests from the client.

    """
    @virtool.gen.coroutine
    def get(self):
        """
        Handles GET requests. This is solely used to serve the client HTML, JS, and images files.

        """
        # Open the index HTML file whether in development mode or not.
        try:
            index = open("client/dist/index.html", "r")
        except FileNotFoundError:
            index = open("client/index.html", "r")

        # The response is the HTML from "index.html".
        response = index.read()

        index.close()

        # The the HTML response and finish the request.
        self.write(response)
        self.flush()
        self.finish()

    @virtool.gen.coroutine
    def post(self):
        """
        Handles POST requests. This interface is used by the client to pass data to the server during first-time
        setup. Websockets are used for all data exchange thereafter.

        """
        # Convert arguments to dict.
        data = {key: self.get_argument(key) for key in self.request.arguments}

        # Handle request.
        response = yield virtool.setup.handle_request(self, data)

        # Return the response from handle_request. Don't return the response if it is from calling save_setup. The
        # server and client are reloading at this point.
        if data["operation"] != "save_setup":
            self.write(response)
            self.set_header('content-type', 'application/json')

        # Finish the request.
        self.flush()
        self.finish()


class SocketHandler(tornado.websocket.WebSocketHandler):
    """
    Sends and receives websocket messages to and from a client. All incoming messages are passed to the shared
    :class:`.Dispatcher` object.

    """
    def __init__(self, *args, **kwargs):
        super(SocketHandler, self).__init__(*args, **kwargs)

        #: A reference to the shared instance of :class:`.Dispatcher`.
        self.dispatcher = self.settings["server"].dispatcher

        #: The IP address of the remote connection.
        self.ip = self.request.remote_ip

        #: A dict describing the user associated with the websocket connection. If the connection is not authorized,
        #: the attribute is assigned ``{"_id": None}``.
        self.user = {"_id": None}

        #: Set to ``True`` when the connection is authorized.
        self.authorized = False

    def check_origin(self, origin):
        return True

    def open(self):
        """
        Called when the websocket connection is opened, adding the :class:`.SocketHandler` object to the dispatcher's
        list of active connections.

        """
        self.dispatcher.connections.append(self)

    def on_message(self, message):
        """
        Called when a websocket message is received. Passes the incoming message to the dispatcher's
        :meth:`~Dispatcher.handle` method.

        :param message: the JSON message received from the client.
        :type message: str

        """
        self.dispatcher.handle(message, self)

    def on_close(self):
        """
        Called the websocket connection closes. The connection is removed from the dispatchers list of active
        connections.

        """
        self.dispatcher.watcher.remove_listener(self)
        self.dispatcher.connections.remove(self)


class UploadHandler(tornado.web.RequestHandler):

    """
    Asynchronously handles uploads using the POST method. Uploaded files are passed to the shared instance of
    :class:`.files.Manager` for handling.

    """
    @virtool.gen.coroutine
    def post(self):
        """
        Handles file upload POST operations from the client by passing them to the shared instance of
        :class:`.files.Manager` owned by the dispatcher. The resultant internal id generated for the file in the HTTP
        response.

        """
        filename = list(self.request.files.keys())[0]

        # Get the name of the file used by the client in the request.
        file = self.request.files[filename][0]

        # Pass the file to the file manager and generate a unique internal id for it.
        file_id = yield self.settings["server"].dispatcher.file_manager.register(
            filename,
            file.body,
            file.content_type,
            download=False
        )

        # Write the generated file id to the HTTP response and finish the request.
        self.write(file_id)
        self.flush()


def find_server_version(install_path="."):
    try:
        return subprocess.check_output(['git', 'describe']).decode().rstrip()
    except (subprocess.CalledProcessError, FileNotFoundError):

        try:
            version_file_path = os.path.join(install_path, "VERSION")

            with open(version_file_path, "r") as version_file:
                return version_file.read().rstrip()

        except FileNotFoundError:
            logger.critical("Could not determine software version.")
            return "Unknown"

