#####
Hooks
#####

Hooks provide a way to do things when events happen during the workflow lifecycle.

:data:`.before_result_upload`
=============================

Do something before the workflow result is uploaded to Virtool.

.. code-block:: python

    @before_result_upload
    def add_field_to_result():
        ...

:data:`.on_success`
===================

Triggered when a job completes successfully.

Parameters supplied are the `Workflow` instance and the results dict.

.. code-block:: python

    @on_success
    async def perform_on_success(workflow: Workflow, results: Dict[str, Any]):
        ...

:data:`.on_failure`
===================

Triggered when a job fails to complete.

The decorated handler function will be passed the exception that caused the failure.

.. code-block:: python

    @on_failure
    async def handle_failure(error: Exception, scope):
        if (isinstance(error, CancelledError):
            await on_cancelled.trigger(scope, error)


:data:`.on_finish`
==================

Triggered when a job finishes, regardless of success or failure.

.. code-block:: python

    @on_finish
    async def perform_on_finish(workflow: Workflow):
        ...

:data:`.on_finalize`
====================

Triggered after job finishes, regardless of success or failure.

Intended for finalization actions such as closing the fixture scope.


:data:`.on_cancelled`
=====================

Triggered when a job is cancelled.

.. code-block:: python

    @on_cancelled
    async def on_cancelled(error: asyncio.CancelledError):
        ...

:data:`.on_load_config`
=======================

Triggered after the workflow configuration is loaded from the CLI arguments and environment variables.

Configuration fixtures are available in the handler function. This hook is used internally in ``virtool-workflow``

.. code-block:: python

    @on_load_config
    def use_config(dev_mode):
        if dev_mode:
            ...

