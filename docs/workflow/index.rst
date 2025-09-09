Workflows
=========

.. _index:

A framework for developing bioinformatic workflows for Virtool.

Virtool Workflow uses decorators to define steps in the workflow.

.. code-block:: python

   from virtool_workflow import step

   @step
   def step_1():
       ...

   @step
   def step_2():
       ...

.. toctree::
    :hidden:

    fixtures.rst
    hooks.rst
    reference.rst
    contributing.rst
