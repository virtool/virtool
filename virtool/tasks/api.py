from typing import Union, List

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400

from virtool.api.response import NotFound, json_response
from virtool.data.utils import get_data_from_req
from virtool.http.routes import Routes
from virtool.tasks.oas import GetTasksResponse, TaskResponse
from virtool.data.errors import ResourceNotFoundError

routes = Routes()


@routes.view("/tasks")
class TasksView(PydanticView):
    async def get(self) -> r200[List[GetTasksResponse]]:
        """
        List all tasks.

        Retrieves a list of all tasks active on the instance. Pagination is not
        supported.

        Status Codes:
            200: Successful operation
        """
        return json_response(await get_data_from_req(self.request).tasks.find())


@routes.view("/tasks/{task_id}")
class TaskView(PydanticView):
    async def get(self, task_id: int, /) -> Union[r200[TaskResponse], r400]:
        """
        Retrieve a task.

        Get the details of a task.

        Status Codes:
            200: Successful operation
            404: Not found
        """

        try:
            task = await get_data_from_req(self.request).tasks.get(task_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(task)
