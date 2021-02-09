from dataclasses import dataclass
from typing import Sequence


@dataclass
class Message:
    interface: str
    operation: str
    id_list: Sequence[str]

    def __repr__(self):
        return f"{self.interface}.{self.operation}"
