"""Request handlers for querying tasks."""

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.tasks.models import Task, TaskCounts

routes = Routes()


class TaskServicesRootView(PydanticView):
    """The only endpoint for the task runner and spawner services."""

    async def get(self) -> r200:
        """Root request handler response for task runner.

        Used for checking if the server is alive.

        Status Codes:
            200: Successful operation
        """
        version = "unknown"
        try:
            version = self.request.app["version"]
        except KeyError:
            pass

        return json_response({"version": version})


@routes.jobs_api.view("/tasks/counts")
class TasksCountsView(PydanticView):
    """Active task counts for KEDA autoscaling.

    Registered on the internal jobs API only. Privacy relies on network
    isolation, so the route is intentionally absent from the public API.
    """

    @policy(PublicRoutePolicy)
    async def get(self) -> r200[TaskCounts]:
        """Get active task counts.

        Returns the number of queued and running tasks for an in-cluster
        autoscaler to poll.

        Status Codes:
            200: Successful operation
        """
        return json_response(await get_data_from_req(self.request).tasks.get_counts())


@routes.view("/tasks")
class TasksView(PydanticView):
    async def get(self) -> r200[list[Task]]:
        """List all tasks.

        Lists all tasks active on the instance. Pagination is not
        supported.

        Status Codes:
            200: Successful operation
        """
        return json_response(await get_data_from_req(self.request).tasks.find())


@routes.view("/tasks/{task_id}")
class TaskView(PydanticView):
    async def get(self, task_id: int, /) -> r200[Task] | r400:
        """Retrieve a task.

        Fetches the details of a task.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            task = await get_data_from_req(self.request).tasks.get(task_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(task)
