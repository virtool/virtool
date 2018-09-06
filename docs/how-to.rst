How-To
======

Lifecycle
---------

All jobs follow a simple lifecycle model.

When a job is initiated by a user a new job object is created using the appropriate job class. The job is queued and
assigned a _waiting_ state.

When resources are available, the :meth:`.Job.run` method is called. This results in a number of method calls being
made in sequence:

1. :meth:`.Job.init_db`
    Initializes a database connection :class:`pymongo.database.Database` at :attr:`.Job.db`.

    Retrieves the job database document and assigns the job attributes :attr:`.Job.proc`, :attr:`.Job.mem`,
    :attr:`.Job.task_name`, and :attr:`.Job.task_args` with the appropriate values from the document.

2. :meth:`.Job.check_db`
    This method should be redefined in the job subclass.

    Gather required data from the database for use in the job stage methods. For example calculate file paths and
    properties of samples used in a given analysis.

3. Stage methods
    Jobs are built my defining stage methods that are called in sequence when the job runs. Stage methods should perform
    distinct actions such as parsing a file or running a ``blast`` subprocess.

    The progress of the job as it relates to completed stages will be automatically relayed to users.


Basics
------

Building a new job using this module is easy.

It consists of extending the :class:`~virtool.job.job.Job` class by defining new job stage methods and adding them to
the :attr:`~virtool.job.job.Job.stage_list` attribute. Stage methods are run sequentially with progress being stored
in the database as the job progresses.

.. code-block:: python


    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.add_numbers
            ]

        def add_numbers(self):
            print(10 + 20)


Parameters
----------

Job parameters are data derived from the Virtool application state that inform the job process.

They should be calculated before stage methods are run at the beginning of the job process. The :meth:`.Job.check_db()`
method can be redefined in job subclasses to populate the :meth:`.Job.params` attribute.

The :meth:`.check_db()` method will be called automatically during job start immediately after a database connection is
made in :meth:`.init_db()`.

We suggest using this model of parameter derivation over deriving parameters on the fly as needed in stage methods. This
allows easy unit testing of individual stage methods by supplying them with mock :attr:`~.Job.params` instead of
providing a testing database.

.. code-block:: python

    class NewJob(virtool.job.Job):

        def check_db(self):
            sample_id = self.task_args["sample_id"]

            document = self.db.analyses.find_one(sample_id)

            self.parameters.update({
                "sample_id": sample_id,
                "paired": document["paired]
            })


When job stage methods start running, they will have access to the :attr:`~.Job.params` and therefore the
``sample_id`` and ``paired`` values.


State
-----

:class:`~virtool.job.job.Job` can be heavily customized to store intermediate data and job results between stage
methods, but we suggest using the predefined :attr:`.Job.intermediate` and :attr:`.Job.results` attributes to these
state data.

The :attr:`.intermediate` attribute should be used for carrying data between stage methods. Deleting unneeded
intermediate values after the intermediate data has been consumed by a subsequent stage is highly recommended.

The :attr:`.results` attribute should be considered immutable and is used to write result files or update the database
at the end of the job.

.. code-block:: python

    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.add_numbers,
                self.divide
            ]

        def add_numbers(self):
            self.intermediate["added"] = 10 + 20

        def divide_by_2(self):
            # Perform another operation on the sum from `add_numbers`.
            self.results["final"] = self.intermediate["added"] / 2

            # Delete stale data.
            del self.intermediate["added"]


.. _subprocesses:

Subprocesses
------------

A major part of the :class:`~virtool.job.job.Job` superclass handles running of subprocesses using the :mod:`subprocess`
module.

Subprocesses are started using the :meth:`.Job.run_subprocess` method. Commands must be of the :class:`list` type.

.. code-block:: python

    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.fastqc
            ]

        def fastqc():
            self.run_subprocess([
                "fastqc",
                "reads.fq"
            ])


One of the primary uses of subprocesses in Virtool jobs is collecting standard output from bioinformatic tools. Handler
functions can be passed to :meth:`.Job.run_subprocess` to process stdout and stderr lines.

.. code-block:: python

    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.blast
            ]

        def blast():
            self.intermediate["blast"] = list()

            # Strip newlines from BLAST output and append to
            # intermediate BLAST list.
            def stdout_handler(line):
                self.intermediate["blast"].append(line.rstrip())

            self.run_subprocess([
                "blastn",
                "-query", "query.fa",
                "-db", "rna",
                "-max_target_seqs", "2"
            ], stdout_handler=stdout_handler)


It is important to keep processing in the `stdout_handler` to a minimum. Long running `stdout_handler` calls can
lead to throttling in the subprocess as the output buffer fills. Perform heavy processing of subprocess output after the
subprocess has finished.

The same techniques can be used to process stderr lines. Note that all stderr is logged automatically even if no
`stderr_handler` is provided.


Database
--------

:class:`~virtool.job.job.Job` objects initiate a connection to the application database when the job starts. The
database is accessible from stage methods through the :attr:`.Job.db` attribute.

:attr:`.Job.db` is a :class:`pymongo.database.Database` object and can be fully utilized to read and modify the Virtool
application database. Refer to the `Pymongo documentation <https://api.mongodb.com/python/current/index.html>`_ to make
use of the database client API.

.. code-block:: python

    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.blast
            ]

        def save_blast(self):
            top = self.intermediate["blast"][:5]

            self.db.analyses.update_one({"_id": self.analysis_id}, {
                "$set": {
                    "blast": top
                }
            })


.. _dispatching:

Dispatching
-----------

If you have used Virtool, you have likely noticed that many user interface components are updated in real time as
changes occur on the server. This is accomplished by dispatching update messages to all connected clients.

Currently, message dispatches have to be triggered explicity from within job processes using the :meth:`.Job.dispatch`
method. Calling this method passes a message to the Virtool server process where it is dispatched.

Messages consist of three parts:

`operation`
    One of 'insert', 'update', or 'remove. Instructs the client on whether the message data

`interface`
    The database collection or other data store being modified. Jobs primary affect the `jobs` and `analyses` database
    collections.

`id_list`
    A list of affected document ids that should be dispatched.

Here is the previous example with dispatching:

.. code-block:: python

    class NewJob(virtool.job.Job):

        def __init__(*args, **kwargs)
            super().__init__(*args, **kwargs)

            self.stage_list = [
                self.blast
            ]

        def save_blast(self):
            top = self.intermediate["blast"][:5]

            self.db.analyses.update_one({"_id": self.analysis_id}, {
                "$set": {
                    "blast": top
                }
            })

            self.dispatch(
                "update",
                "analyses",
                [self.analysis_id]
            )
