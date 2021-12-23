from dataclasses import dataclass
from typing import Sequence, Union

from virtool.dispatcher.operations import Operation


@dataclass
class Change:
    """
    Represents a change in a resource.

    For now, only used to trigger the dispatch of websocket messages containing a minimal update of
    the resource to connected browser clients.

    """

    interface: str
    operation: Operation
    id_list: Sequence[Union[int, str]]

    @property
    def target(self):
        return f"{self.interface}.{self.operation}"

    def __repr__(self):
        return (
            f"<Change"
            f' interface="{self.interface}"'
            f' operation="{self.operation}"'
            f' id_list="{self.id_list}">'
        )
