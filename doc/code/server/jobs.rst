Jobs
====

Documents
---------

All Virtool jobs are stored as documents in the MongoDB jobs collection. Here is a complete example of a job
document:

.. code-block:: javascript

    document = {
        // The unique database id for the job.
        _id: "f41e8c"

        // The document's version number.
        _version: 7,

        // The task name associated with the job.
        task: "add_host",

        // The arguments (task_args) passed to the associated Job object when it was instantiated.
        args: {
            _id: "Prunus persica",
            _version: 0,
            description: "Peach",
            file: "prunus_persica.fa",
            added: false,
            job: "f41e8c",
            username: "igboyes"
        },

        // The number of cores the job needs to run.
        proc: 1,

        // The amount of memory in GB that the job needs to run.
        mem: 4,

        // An array containing the status updates recorded while the job is active (truncated).
        status: [
            {
                "stage" : "bowtie_build",
                "progress" : 0.429,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:48:22.375557"
            },
            {
                "stage" : "snap_build",
                "progress" : 0.571,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:52:18.472402"
            },
            {
                "stage" : "update_db",
                "progress" : 0.714,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:53:24.774645"
            },
        ],

        // The name of the user that started the job.
        username: "igboyes"
    }

.. automodule:: jobs

Minimal Job Documents
~~~~~~~~~~~~~~~~~~~~~

Job documents are minimized for syncing by first projecting only the fields ``task``, ``status``, ``proc``, ``mem``,
``username``, ``args``, and ``archived``. The projected documents are then further processed using the collection's
:meth:`~.jobs.Collection.sync_processor` method.

.. automethod:: jobs.Collection.sync_processor

Tasks
-----

Each job has a task name, which is stored in its database document with the key ``task``. Active jobs, those that
running or waiting to run, are represented by instances of task-specific subclasses of :class:`~.job.Job`. The
available task-specific subclasses are stored as values keyed by their task names in :data:`.TASK_CLASSES`.

.. autodata:: jobs.TASK_CLASSES
    :annotation: = {}

The tasks currently available in Virtool are:

+--------------------+----------------------------+
| Task Name          | Class                      |
+====================+============================+
| rebuild_index      | :class:`.RebuildIndex`     |
+--------------------+----------------------------+
| pathoscope_bowtie  | :class:`.PathoscopeBowtie` |
+--------------------+----------------------------+
| pathoscope_snap    | :class:`.PathoscopeSNAP`   |
+--------------------+----------------------------+
| nuvs               | :class:`.NuVs`             |
+--------------------+----------------------------+
| create_sample      | :class:`.RebuildIndex`     |
+--------------------+----------------------------+

Users can set limits on the number of jobs with the same task that may run concurrently. The number of running jobs with
a given task are stored in :data:`.jobs.Collection.task_counts`.

.. autoinstanceattribute:: jobs.Collection.task_counts
    :annotation: = {}



Manager
-------

.. autoclass:: jobs.Collection
    :show-inheritance:

Creating Jobs
-------------

Jobs are created by calling :meth:`~jobs.Collection.new`. This method is called from exposed methods in other
collections that allow the user to initiate intensive tasks that need to run in a separate Python process.

.. automethod:: jobs.Collection.new

Dicts describing waiting or running jobs are stored in :attr:`.jobs_dict`.

.. autoinstanceattribute:: jobs.Collection.jobs_dict
        :annotation: = {}

        Each job_dict in :attr:`.jobs_dict` has the following structure:

        +---------+--------------------------------------------------------+
        | Key     | Value                                                  |
        +=========+========================================================+
        | obj     | the :class:`~.job.Job` object                          |
        +---------+--------------------------------------------------------+
        | task    | the name of the task                                   |
        +---------+--------------------------------------------------------+
        | started | a :class:`bool` indicating whether the job has started |
        +---------+--------------------------------------------------------+
        | proc    | the number of procs the job is allowed to use          |
        +---------+--------------------------------------------------------+
        | mem     | the amount of memory in GB the job is allowed to use   |
        +---------+--------------------------------------------------------+

Newly created jobs will remain in a waiting state until the resource requirements set in ``proc`` and ``mem`` are
available and the instance limit for the task is not been maxed. When the job starts the task instance count is
incremented by one, the resource counters in :attr:`.used` are recalculated based, and the value for ``started`` in
the job dict is set to ``True``.

Cancelling Jobs
---------------

Jobs are cancelled by calling :meth:`._cancel`. This method in indirectly exposed to users through the :meth:`.cancel`
:ref:`exposed method <exposed-methods>`.

.. automethod:: jobs.Collection._cancel

.. automethod:: jobs.Collection.cancel

