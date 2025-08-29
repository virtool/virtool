from abc import ABC
from typing import TYPE_CHECKING

from virtool.data.errors import ResourceError
from virtool.jobs.tasks import JobsCleanTask
from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class Action(ABC):
    async def run(self, data_layer: "DataLayer", *args, **kwargs) -> None: ...


class TaskAction:
    def __init__(self, task: type[BaseTask]):
        self.task = task

    async def run(self, data_layer: "DataLayer", *args, **kwargs):
        return await data_layer.tasks.create(self.task)


actions = {"relist_jobs": TaskAction(JobsCleanTask)}


def get_action_from_name(name: str) -> Action:
    """Derive an action from its name.

    :param name: the name of the action
    :return: the action
    """
    try:
        return actions[name]
    except KeyError:
        raise ResourceError("Invalid action name")
