Reference
=========

``virtool.job.db``
------------------

.. automodule:: virtool.job.db
    :members:


``virtool.job.job``
-------------------

.. automodule:: virtool.job.job

    .. autoclass:: Job

        .. autoinstanceattribute:: db_connection_string
            :annotation:

        .. autoinstanceattribute:: db_name
            :annotation:

        .. autoinstanceattribute:: settings
            :annotation:

        .. autoinstanceattribute:: id
            :annotation:

        .. autoinstanceattribute:: q
            :annotation:

        .. autoinstanceattribute:: db
            :annotation:

        .. autoinstanceattribute:: task_name
            :annotation:

        .. autoinstanceattribute:: task_args
            :annotation:

        .. autoinstanceattribute:: proc
            :annotation:

        .. autoinstanceattribute:: mem
            :annotation:

        .. autoinstanceattribute:: params
            :annotation:

        .. autoinstanceattribute:: intermediate
            :annotation:

        .. autoinstanceattribute:: results
            :annotation:

        .. automethod:: init_db

        .. automethod:: check_db

        .. automethod:: run

        .. automethod:: run_subprocess

        .. seealso::
            How-to documentation for :ref:`subprocesses`.

        .. automethod:: dispatch

        .. seealso::
            How-to documentation for :ref:`dispatching`.

        .. automethod:: cleanup

    .. autofunction:: handle_exception

    .. autofunction:: handle_sigterm

    .. autofunction:: watch_pipe


``virtool.job.utils``
---------------------

.. automodule:: virtool.job.utils
    :members:
