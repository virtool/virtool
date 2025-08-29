Reference
#########

``virtool_workflow.analysis``
*****************************

``fastqc``
==========

.. automodule:: virtool_workflow.analysis.fastqc

    .. autofixture:: fastqc

    .. autoprotocol:: FastQCRunner


``skewer``
==========

.. automodule:: virtool_workflow.analysis.skewer

    .. autofixture:: skewer

    .. autoclass:: SkewerConfiguration
        :members:

    .. autoclass:: SkewerResult
        :members:

    .. autoprotocol:: SkewerRunner


``trimming``
============

.. automodule:: virtool_workflow.analysis.trimming
    :members:


``virtool_workflow.data``
*************************

``analysis``

``analyses``
============

.. automodule:: virtool_workflow.data.analyses

    .. autofixture:: analysis

    .. autoclass:: WFAnalysis
        :members:


``hmms``
========

.. automodule:: virtool_workflow.data.hmms

    .. autoclass:: WFHMMs
        :members:


``indexes``
===========

.. automodule:: virtool_workflow.data.indexes

    .. autofixture:: index

    .. autoclass:: WFIndex
        :members:

    .. autoclass:: WFNewIndex
        :members:


``jobs``
========

.. automodule:: virtool_workflow.data.jobs
    :members:


``ml``
======

.. automodule:: virtool_workflow.data.ml
    :members:


``samples``
===========

.. automodule:: virtool_workflow.data.samples

    .. autofixture:: sample

    .. autoclass:: WFSample
        :members:


``subtractions``
================

.. automodule:: virtool_workflow.data.subtractions

    .. autofixture:: subtractions

    .. autoclass:: WFSubtraction
        :members:


``uploads``
===========

.. automodule:: virtool_workflow.data.uploads

    .. autofixture:: uploads

    .. autoclass:: WFUploads
        :members:


``virtool_workflow.runtime``
****************************

``config``
==========

.. automodule:: virtool_workflow.runtime.config

    .. autofixture:: config

    .. autoclass:: RunConfig
        :members:


``run_subprocess``
==================

.. automodule:: virtool_workflow.runtime.run_subprocess

    .. autofixture:: run_subprocess

    .. autoprotocol:: RunSubprocess


``virtool_workflow.decorators``
===============================

.. automodule:: virtool_workflow.decorators
    :members:


``virtool_workflow.hooks``
==========================

.. automodule:: virtool_workflow.hooks
    :members:


``virtool_workflow.errors``
=============================

.. automodule:: virtool_workflow.errors

    .. autoexception:: JobsAPIError
        :members:

    .. autoexception:: JobsAPIBadRequest
        :members:

    .. autoexception:: JobsAPIUnauthorized
        :members:

    .. autoexception:: JobsAPINotFound
        :members:

    .. autoexception:: JobsAPIConflict
        :members:


``virtool_workflow.workflow``
=============================

.. automodule:: virtool_workflow.workflow
    :members: Workflow, WorkflowStep

