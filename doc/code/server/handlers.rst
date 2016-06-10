================
Request Handlers
================

Request handlers are registered with in :class:`virtool.web.Application`. These handlers are used to respond to varying
requests from clients. Some of these handlers make use of custom classes documented in this section. The others use
:class:`tornado.web.StaticFileHandler`.

================================== ================================  =======================
URI                                Purpose                           Custom Class
================================== ================================  =======================
/                                  Setup and serving client HTML     :class:`.HTTPHandler`
/ws                                Websocket communication           :class:`.SocketHandler`
/upload                            File uploads                      :class:`.UploadHandler`
/download                          File downloads
/doc                               Documentation
/(app.js, favicon.png, index.html) Client static files
================================== ================================  =======================

.. automodule:: virtool.web

    .. autoclass:: HTTPHandler
        :show-inheritance:

        .. automethod:: get

        .. automethod:: post

    .. autoclass:: SocketHandler
        :show-inheritance:

        .. autoinstanceattribute:: dispatcher
            :annotation:

        .. autoinstanceattribute:: ip
            :annotation:

        .. autoinstanceattribute:: authorized
            :annotation: = False

        .. autoinstanceattribute:: user
            :annotation: = {"_id": None}

        .. automethod:: open

        .. automethod:: on_message

        .. automethod:: on_close

    .. autoclass:: UploadHandler
        :show-inheritance:

        .. automethod:: post






