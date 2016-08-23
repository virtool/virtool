File Management
===============

There are a few cases where Virtool users directly observe or interact with on-disk files on the server host. As a
result some functionality has been included to allow transfers between the client and host and to keep file information
in sync between the client and host.

.. _file-transfers:

File Transfers
--------------

Virtool can accept file uploads from clients and make files available to clients for download. This can cause two
problems:

1. A large amount of disk space can be consumed by stale files if they are not regularly purged.
2. Uploaded files could trip over each others' names if they retain the same names on the server as those that they were
   uploaded with.

Virtool implements a minimal file manager to deal with these problems:

.. code-block:: python

    file_manager = virtool.files.Manager(server)

    data = [
        "apple",
        "banana",
        "orange",
        "pear"
    ]

    # Convert the list of fruit to a JSON-formatted string.
    json_string = json.dumps(data)

    # Register the file with the file manager. This returns a unique id for the file.
    file_id = yield file_manager.register(
        "data.json",
        json_string,
        content_type="json"
    )

When the content is registered, it is given a unique file id and written to ``<data_path>/download/<file_id>`` if
``download`` is set to ``True`` or ``<data_path>/upload/<file_id>`` if download is set to False. Files in
``<data_path>/download/<file_id>`` are retrievable at ``http://<root>/download/<file_id>``.

.. automodule:: virtool.files

.. autoclass:: Manager

    .. automethod:: register

    .. automethod:: iterate

    .. automethod:: write_file

    .. automethod:: remove_file


File Watcher
------------

The :class:`.Watcher` object can watch a specific folder and send changes in its contents to all listening
:class:`.web.SocketHandler` objects.

.. autoclass:: Watcher

    .. autoinstanceattribute:: files
        :annotation:

    .. autoinstanceattribute:: listeners
        :annotation:

    .. automethod:: register

    .. automethod:: add_listener

    .. automethod:: remove_listener

    .. automethod:: run



