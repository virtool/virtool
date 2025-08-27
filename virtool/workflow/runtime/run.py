import asyncio
import signal
import sys
from asyncio import CancelledError
from collections.abc import Callable

import sentry_sdk
from pyfixtures import FixtureScope, runs_in_new_fixture_context
from structlog import get_logger

from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import JobState
from virtool.logs import configure_logging
from virtool.redis import Redis
from virtool.sentry import configure_sentry
from virtool.version import get_virtool_version
from virtool.workflow.acquire import acquire_job_by_id
from virtool.workflow.client import api_client
from virtool.workflow.hooks import (
    cleanup_builtin_status_hooks,
    on_cancelled,
    on_error,
    on_failure,
    on_finish,
    on_result,
    on_step_finish,
    on_step_start,
    on_success,
    on_terminated,
    on_workflow_start,
)
from virtool.workflow.runtime.discover import (
    load_builtin_fixtures,
    load_custom_fixtures,
    load_workflow_from_file,
)
from virtool.workflow.runtime.events import Events
from virtool.workflow.runtime.path import create_work_path
from virtool.workflow.runtime.ping import ping_periodically
from virtool.workflow.runtime.redis import (
    get_next_job_with_timeout,
    wait_for_cancellation,
)
from virtool.workflow.utils import get_workflow_version
from virtool.workflow.workflow import Workflow


def configure_status_hooks() -> None:
    """Configure built-in job status hooks.

    Push status updates to API when various lifecycle hooks are triggered.
    """

    @on_step_start
    async def handle_step_start(push_status) -> None:
        await push_status()

    @on_error(once=True)
    async def handle_error(push_status) -> None:
        await push_status()

    @on_cancelled(once=True)
    async def handle_cancelled(push_status) -> None:
        await push_status()

    @on_terminated(once=True)
    async def handle_terminated(push_status) -> None:
        await push_status()

    @on_success(once=True)
    async def handle_success(push_status) -> None:
        await push_status()


async def execute(
    workflow: Workflow, scope: FixtureScope, events: Events, logger
) -> None:
    """Execute a workflow.

    :param workflow: The workflow to execute
    :param scope: The :class:`FixtureScope` to use for fixture injection
    :param events: The events object for cancellation/termination
    :param logger: The configured logger instance

    """
    await on_workflow_start.trigger(scope)

    scope["_state"] = JobState.RUNNING

    try:
        for step in workflow.steps:
            scope["_step"] = step

            bound_step = await scope.bind(step.function)

            await on_step_start.trigger(scope)
            logger.info("running workflow step", name=step.display_name)
            await bound_step()
            await on_step_finish.trigger(scope)

    except CancelledError:
        logger.info("cancellation or termination interrupted workflow execution")

        if events.cancelled.is_set():
            logger.info("workflow cancelled")

            scope["_state"] = JobState.CANCELLED

            await asyncio.gather(
                on_cancelled.trigger(scope),
                on_failure.trigger(scope),
            )
        else:
            logger.info("workflow terminated")

            scope["_state"] = JobState.TERMINATED

            if not events.terminated.is_set():
                logger.warning(
                    "workflow terminated without sigterm. this should not happen.",
                )

            await asyncio.gather(
                on_terminated.trigger(scope),
                on_failure.trigger(scope),
            )

    except Exception as error:
        scope["_error"] = error
        scope["_state"] = JobState.ERROR

        logger.exception(error)

        await asyncio.gather(on_error.trigger(scope), on_failure.trigger(scope))

        if isinstance(error, asyncio.CancelledError):
            raise

    else:
        scope["_state"] = JobState.COMPLETE
        scope["_step"] = None

        if "results" in scope:
            await on_result.trigger(scope)

        await on_success.trigger(scope)

    finally:
        await on_finish.trigger(scope)


async def run_workflow(
    config: WorkflowConfig,
    job_id: str,
    workflow: Workflow,
    events: Events,
    logger,
) -> None:
    # Configure hooks here so that they can be tested when using `run_workflow`.
    configure_status_hooks()

    load_builtin_fixtures()

    job = await acquire_job_by_id(config.jobs_api_connection_string, job_id)

    async with (
        api_client(
            config.jobs_api_connection_string,
            job.id,
            job.key,
        ) as api,
        FixtureScope() as scope,
    ):
        # These fixtures should not be used directly by the workflow. They are used
        # by other built-in fixtures.
        scope["_api"] = api
        scope["_config"] = config
        scope["_error"] = None
        scope["_job"] = job
        scope["_state"] = JobState.WAITING
        scope["_step"] = None
        scope["_workflow"] = workflow

        scope["logger"] = get_logger("workflow")
        scope["mem"] = config.mem
        scope["proc"] = config.proc
        scope["results"] = {}

        # Set Sentry context with workflow metadata
        sentry_sdk.set_context(
            "workflow",
            {
                "runtime_version": get_virtool_version(),
                "workflow_name": job.workflow,
                "workflow_version": get_workflow_version(),
                "job_id": job_id,
            },
        )

        scope["work_path"] = await create_work_path(config.work_path)

        async with ping_periodically(api, job_id):
            await execute(workflow, scope, events, logger)
            cleanup_builtin_status_hooks()


@runs_in_new_fixture_context()
async def start_runtime(
    config: WorkflowConfig,
    workflow_loader: Callable[[], Workflow] = load_workflow_from_file,
) -> None:
    """Start the workflow runtime.

    The runtime loads the workflow and fixtures. It then waits for a job ID to be pushed
    to the configured Redis list.

    When a job ID is received, the runtime acquires the job from the jobs API and
    """
    configure_logging(bool(config.sentry_dsn))

    logger = get_logger("runtime")
    logger.info(
        "found virtool workflow runtime",
        version=get_virtool_version(),
    )

    workflow = workflow_loader()

    load_builtin_fixtures()
    load_custom_fixtures()

    configure_sentry(config.sentry_dsn, release=get_workflow_version())

    async with Redis(config.redis_connection_string) as redis:
        try:
            job_id = await get_next_job_with_timeout(
                config.redis_list_name, redis, config.timeout
            )
        except TimeoutError:
            # This happens due to Kubernetes scheduling issues or job cancellations. It
            # is not an error.
            logger.warning("timed out while waiting for job id")
            return

    events = Events()

    run_workflow_task = asyncio.create_task(
        run_workflow(
            config,
            job_id,
            workflow,
            events,
            logger,
        ),
    )

    def terminate_workflow(*_):
        logger.info("received sigterm. terminating workflow.")
        events.terminated.set()
        run_workflow_task.cancel()

    signal.signal(signal.SIGTERM, terminate_workflow)

    def cancel_workflow(*_):
        logger.info("received cancellation signal from redis")
        events.cancelled.set()
        run_workflow_task.cancel()

    async with Redis(config.redis_connection_string) as redis:
        cancellation_task = asyncio.create_task(
            wait_for_cancellation(redis, job_id, cancel_workflow),
        )

        await run_workflow_task

        cancellation_task.cancel()
        await cancellation_task

    if events.terminated.is_set():
        sys.exit(124)
