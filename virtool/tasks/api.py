"""Request handlers for querying tasks."""

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.tasks.models import Task

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
