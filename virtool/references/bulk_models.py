from collections.abc import Callable, Coroutine
from dataclasses import astuple, dataclass, field
from typing import Any

from pymongo import DeleteMany, DeleteOne, UpdateOne

from virtool.models.enums import HistoryMethod
from virtool.types import Document


@dataclass
class HistoryChange:
    verb: HistoryMethod
    description: str
    otu_id: str
    old: dict | None = None


@dataclass
class SequenceChanges:
    updates: list[UpdateOne] | None = field(default_factory=list)
    inserts: list[dict] | None = field(default_factory=list)
    deletes: list[DeleteMany] | None = field(default_factory=list)

    @property
    def sequence_changes(self):
        return sum(len(change) for change in astuple(self) if change is not None)


@dataclass(init=True)
class OTUChange:
    otu_change: UpdateOne | dict | DeleteOne
    sequences: SequenceChanges
    history_method: HistoryMethod
    old: dict | None = None
    otu_id: str | None = None

    def __post_init__(self):
        self.remaining_sequence_changes = self.sequences.sequence_changes
        self.otu_changed = False

    @property
    def is_complete(self):
        return self.otu_changed and self.remaining_sequence_changes == 0


class OTUUpdate(OTUChange):
    def __init__(self, otu_change, sequences, old, otu_id):
        super().__init__(
            otu_change,
            sequences,
            HistoryMethod.update,
            old,
            otu_id=otu_id,
        )


class OTUInsert(OTUChange):
    def __init__(self, otu_change, sequences):
        super().__init__(otu_change, sequences, HistoryMethod.create)


class OTUDelete(OTUChange):
    def __init__(self, otu_change, sequences, old, reference_update, otu_id):
        super().__init__(
            otu_change,
            sequences,
            HistoryMethod.remove,
            old,
            otu_id=otu_id,
        )
        self.is_reference_updated = False
        self.reference_update = reference_update

    @property
    def is_complete(self):
        return (
            self.otu_changed
            and self.remaining_sequence_changes == 0
            and self.is_reference_updated
        )


@dataclass
class OTUData:
    old: dict
    otu: Document


class BufferData:
    data: Any
    callback: Callable[[Any], Coroutine] | None


@dataclass
class DBBufferData(BufferData):
    data: UpdateOne | DeleteOne | DeleteMany | dict
    callback: Callable[[Any], Coroutine] | None = None


@dataclass
class OTUUpdateBufferData(BufferData):
    data: dict | OTUData | OTUChange
    callback: Callable[[Any], Coroutine] | None = None


@dataclass
class DataChunk:
    data: list[BufferData]
    bulk_function: Callable[[Any], Coroutine]
