from dataclasses import dataclass

from virtool.types import Document


@dataclass
class WSMessage:
    """A message sent to a websocket client."""

    operation: str
    interface: str


@dataclass
class WSInsertMessage(WSMessage):
    """A message sent to a websocket client that describes a new resource."""

    data: Document


@dataclass
class WSUpdateMessage(WSMessage):
    """A message sent to a websocket client that describes an update to a resource."""

    data: Document


@dataclass
class WSDeleteMessage(WSMessage):
    """A message sent to a websocket client that lists IDs of deleted resources."""

    data: list[int | str]
