"""Request handlers for querying tasks."""

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.status import R200, R400
from virtool.api.view import APIView
from virtool.data.errors import ResourceNotFoundError
from virtool.tasks.oas import TaskMinimalResponse, TaskResponse

routes = Routes()


class TaskServicesRootView(APIView):
    """The only endpoint for the task runner and spawner services."""

    async def get(self) -> R200:
        """Root request handler response for task runner.

        Used for checking if the server is alive.

        Status Codes:
            200: Successful operation
        """
        try:
            version = self.request.app["version"]
        except KeyError:
            version = "unknown"

        return json_response({"version": version})


@routes.web.view("/tasks")
class TasksView(APIView):
    async def get(self) -> R200[list[TaskMinimalResponse]]:
        """List all tasks.

        Lists all tasks active on the instance. Pagination is not
        supported.

        Status Codes:
            200: Successful operation
        """
        return json_response(await self.data.tasks.find())


@routes.web.view("/tasks/{task_id}")
class TaskView(APIView):
    async def get(self, task_id: int, /) -> R200[TaskResponse] | R400:
        """Retrieve a task.

        Fetches the details of a task.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            task = await self.data.tasks.get(task_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(task)
