"""Main definitions for Virtool Workflows."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from virtool.utils import coerce_to_coroutine_function
from virtool.workflow.errors import WorkflowStepDescriptionError


@dataclass
class Workflow:
    """A step-wise, long-running operation."""

    steps: list["WorkflowStep"] = field(default_factory=list)

    def step(
        self,
        step: Callable | None = None,
        *,
        name: str | None = None,
    ) -> Callable:
        """Decorator for adding a step to the workflow."""
        if step is None:

            def _decorator(func: Callable):
                self.step(func, name=name)

            return _decorator

        step = WorkflowStep.from_callable(step, display_name=name)
        self.steps.append(step)
        return step


@dataclass(frozen=True)
class WorkflowStep:
    """Metadata for a workflow step.

    :param name: The presentation name for the step.
    :param description: The description of the step.
    :param call: The async step function.
    """

    display_name: str
    description: str
    function: Callable[..., Awaitable[Any]]

    @classmethod
    def from_callable(
        cls,
        func: Callable[..., Any],
        *,
        display_name: str | None = None,
        description: str | None = None,
    ) -> "WorkflowStep":
        """Create a WorkflowStep from a callable.

        :param func: The callable to be used.
        :param display_name: The display name to be used, if None then a display name
            will be created based on the function name of `call`.
        :param description: A text description of the step. If None then the docstring
            `call` will be used.
        """
        func = coerce_to_coroutine_function(func)

        display_name = display_name or func.__name__.replace("_", " ").title()

        try:
            description = description or _get_description_from_docstring(func)
        except ValueError:
            description = ""

        return cls(
            display_name=display_name,
            description=description,
            function=func,
        )

    async def __call__(self, *args, **kwargs):
        return await self.function(*args, **kwargs)


def _get_description_from_docstring(func: Callable[..., Any]) -> str:
    """Extract the first line of the docstring as a description for a step function.

    :param func: The step function to get the description for
    :raise ValueError: When `call` does not have a docstring
    """
    if func.__doc__ is None:
        raise WorkflowStepDescriptionError

    return func.__doc__.strip().split("\n")[0]
