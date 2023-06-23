from dataclasses import dataclass

from virtool.types import Document


@dataclass
class WSMessage:
    """
    Represents a message sent to a websocket client.

    """

    operation: str
    interface: str


@dataclass
class WSInsertMessage(WSMessage):
    """
    Represents a message sent to a websocket client that describes as new resource.

    """

    data: Document


@dataclass
class WSUpdateMessage(WSMessage):
    """
    Represents a message sent to a websocket client that describes an update to an
    existing resource.

    """

    data: Document


@dataclass
class WSDeleteMessage(WSMessage):
    """
    Represents a message sent to a websocket client that lists the IDs of deleted
    resources.

    """

    data: list[int | str]
