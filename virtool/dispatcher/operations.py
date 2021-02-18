"""
Constants for dispatcher operation types.
"""
from typing import Literal

Operation = Literal[
    "insert",
    "update",
    "delete"
]

INSERT: Operation = "insert"
UPDATE: Operation = "update"
DELETE: Operation = "delete"
