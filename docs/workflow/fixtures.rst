########
Fixtures
########

Fixtures are functions whose return values can be requested and provided to other functions. Their implementation in
Virtool Workflow was inspired by `pytest <https://docs.pytest.org/en/2.8.7/fixture.html>`_.

:ref:`Built-in fixtures <Built-in Fixtures>` are used in Virtool to allow controlled access to Virtool application data
required for the workflow to run. Users can also create their own fixtures to share data between steps or to reuse code.

Fixtures are requested in a by including the fixture name as an argument in the requesting function. For example:

.. code-block:: python

    from virtool_workflow import fixture, step

    @fixture
    def sequence():
        return "ATGGACAGGTAGGCACAACACA"

    @step
    async def step_1(sequence):
        with open("genome.fa", "r") as f:
            detected = sequence in f.read():


Configuration
=============

Virtool Workflow includes many built-in fixtures for interacting with the workflow environment and accessing Virtool
application data.

Configuration
-------------

Fixtures for accessing workflow configuration data.

:attr:`.config`
^^^^^^^^^^^^^^^

The configuration object for the workflow run.

Returns a :class:`.RunConfig`.


:func:`.mem`
^^^^^^^^^^^^

The maximum memory (GB) the the workflow can use at once.

Use this fixture to configure memory limit options on external tools. Virtool Workflow will automatically limit memory
usage for internal operations like decompression.

Returns an :class:`int`.


:func:`.proc`
^^^^^^^^^^^^^

The maximum number of processors that the workflow can use at once.

Use this fixture to provide thread or process count options to external tools. Virtool Workflow will use the allowed
number of processors for automatic operations like decompression.

Returns an :class:`int`

.. code-block:: python

    @step
    async def prepare(proc: int):
        await run_bowtie(num_cpu=proc)


:func:`.work_path`
^^^^^^^^^^^^^^^^^^

The path to a temporary work directory where all files for the running workflow should be stored.

Application data automatically loaded by data fixtures like :ref:`samples` or :ref:`subtractions` will be stored in the
work directory.

Returns a :class:`~pathlib.Path` object.

.. code-block:: python

    @step
    async def prepare(work_path: Path):
        work_path.mkdir("output")


Utility Fixtures
----------------

Virtool Workflow is asynchronous first. There are some utility fixtures to make it easier to run external tools and
heavier analysis work in Python.

:attr:`.run_subprocess`
^^^^^^^^^^^^^^^^^^^^^^^

A utility for starting external programs as new processes.

Example:

.. code-block:: python

    @step
    async def bowtie_build(proc: int, run_subprocess: RunSubprocess, work_path: Path):
        """Build a Bowtie2 index in a subprocess."""
        fasta_path = work_path / "index.fa"
        index_path = work_path / "index"

        command = [
            "bowtie2-build",
            "-f",
            "--threads", str(proc),
            fasta_path,
            index_path
        ]

        await run_subprocess(command)


Data Fixtures
-------------

Fixtures for accessing application data available to the workflow.

These fixtures trigger requests to the Virtool server to retrieve the required data. Data is only downloaded if the
corresponding fixture is requested in a workflow step or custom fixture.

:func:`.analysis`
^^^^^^^^^^^^^^^^^

The analysis associated with the running workflow.

:fixture

This fixture will be assigned if the workflow is responsible for populating a new analysis.

Returns an :class:`.WFAnalysis` object.


:func:`.hmms`
^^^^^^^^^^^^^

Returns an :class:`.HMMs` object that:

1. A `cluster_annotation_map` attribute for mapping HMM cluster numbers to Virtool annotation records.
2. Downloads and provides the path to `HMMER <http://hmmer.org/>`_-compatible HMM files in the workflow work directory.

When the :func:`.hmms` fixture is requested, the HMM data is automatically downloaded and processed so it is ready to
use.

.. code-block:: python

    @step
    async def hmmer(hmms: HMMs, work_path: Path):
        """
        Calls run_hmmer(), a function that executes hmmscan using the
        passed FASTA file and profile paths.

        Then, get the annotation ID for the first HMM hit. The function
        get_first_hit() returns the first hit from an HMMER output file
        given its path.

        """
        result_path = await run_hmmer(
            work_path / "query.fa",
            hmms.path
        )

        first_hit = get_first_hit(result_path)

        annotation_id = hmms.cluster_annotation_map[first_hit.cluster_id]


:func:`.indexes`
^^^^^^^^^^^^^^^^

The Virtool `reference indexes <https://www.virtool.ca/docs/manual/guide/indexes>`_ available for the current workflow.

When the :func:`.indexes` fixtures is requested,

Returns a :class:`list` of :class:`.Index` objects.

.. code-block:: python

    @step
    async def map_to_first_index(index: List[Index]):
        pass


:func:`.reads`
^^^^^^^^^^^^^^

Provides access to reads files and properties

Does not trim reads if a matching trimmed set is already cached on the Virtool server. Instead the cache will be
downloaded and paths will be accessible at ``reads.paths``.

If no cache exists, the trimming for the sample will be run and the results cached and provided to the workflow at
``reads.paths``.

Returns a :class:`.Reads` object.


.. code-block:: python

    async def map_reads(indexes: List[Index]: reads: Reads):
        """
        Maps reads against the first available index using Bowtie2.

        """
        left_reads_path, right_reads_path = reads.paths

        await map_against_first_index(
            indexes[0],
            left_reads_path,
            right_reads_path
        )


:func:`.results`
^^^^^^^^^^^^^^^^

Provides a way to store analysis results that will be attached to the analysis record when the workflow completes.

Returns a :class:`.dict`.

.. code-block:: python

    @step
    async def final_step(results: dict)
        """
        Set a key on the results fixture that will result in the data being
        retained in the analysis record.

        """
        results["counts"] = {
            "ab12": 12031,
            "bd34": 2019002,
            "ef56": 2110,
            "gh78": 48978
        }


:func:`.sample`
^^^^^^^^^^^^^^^

The `sample <https://www.virtool.ca/docs/manual/guide/samples>`_ associated with the workflow run.

Returns a :class:`.Sample` object that can be used to access sample data. For analysis workflows, this will be the
sample being analyzed.

.. code-block:: python

    @step
    async def align(sample: Sample):
        # The library type of the sample: normal, srna, or amplicon.
        library_type: str = sample.library_type

        # Whether the sample Illumina dataset is paired or not.
        paired: bool = sample.paired



:func:`.subtractions`
^^^^^^^^^^^^^^^^^^^^^

The Virtool `subtractions <https://www.virtool.ca/docs/manual/guide/subtraction>`_ that were selected by the Virtool
user when the analysis workflow was started.

Returns a :class:`.list` of :class:`.Subtraction` objects.

.. code-block:: python

    async def map_subtraction(reads: Reads, subtractions: List[WFSubtraction]):
        """
        Map reads against a subtraction to eliminate non-pathogen information
        from the analysis.

        """
        await run_bowtie(
            reads_path=reads.left
            index_path=subtractions[0].bowtie2_index_path
            num_cpu=proc
        )


Writing Fixtures
================

Fixtures are created by decorating functions with :func:`.fixture`.

.. code-block:: python

    @fixture
    def package_name() -> str:
        return "virtool-workflow==0.5.2"


Fixtures Using Other Fixtures
-----------------------------

Fixtures may depend on other fixtures.

Here is an example of how two fixtures (`package_name` and `package_version`) can be composed:

.. code-block:: python

    @fixture
    def package_name() -> str:
        return "virtool-workflow==0.5.2"

    @fixture
    def package_version(package_name: str):
        return package_name.split("==")[1]


Data Sharing with Fixtures
--------------------------

Once instantiated, a fixture, will persist through a workflow's entire execution. This means that mutable objects,
such as dictionaries, can be used to pass information between the steps of a workflow.

.. code-block:: python

    from virtool_workflow import fixture, step

    @fixture
    def mutable_fixture():
        return dict()

    @step
    def step_1(mutable_fixture):
        mutable_fixture["intermediate value"] = "some workflow state"

    @step
    def step_2(mutable_fixture):
        print(mutable_fixture["intermediate value"]) # "some workflow state"
