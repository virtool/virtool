from enum import Enum


class Status(Enum):
    WAITING = "waiting"
    PREPARING = "preparing"
    CANCELLED = "cancelled"
    ERROR = "error"
    COMPLETE = "complete"
