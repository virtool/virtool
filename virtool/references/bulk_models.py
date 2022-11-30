from dataclasses import dataclass, astuple
from typing import Optional, List, Union, Callable, Any, Coroutine

from pymongo import UpdateOne, DeleteMany, DeleteOne
from virtool_core.models.enums import HistoryMethod

from virtool.types import Document


@dataclass
class HistoryChange:
    verb: HistoryMethod
    description: str
    otu_id: str
    old: Optional[dict] = None


@dataclass
class SequenceChanges:
    updates: Optional[List[UpdateOne]] = None
    inserts: Optional[List[dict]] = None
    deletes: Optional[List[DeleteMany]] = None

    @property
    def sequence_changes(self):
        return sum([len(change) for change in astuple(self) if change is not None])


@dataclass(init=True)
class OTUChange:
    otu_change: Union[UpdateOne, dict, DeleteOne]
    sequences: SequenceChanges
    history_method: HistoryMethod
    old: Optional[dict] = None
    otu_id: Optional[str] = None

    def __post_init__(self):
        self.remaining_sequence_changes = self.sequences.sequence_changes
        self.otu_changed = False

    @property
    def is_complete(self):
        return self.otu_changed and self.remaining_sequence_changes == 0


class OTUUpdate(OTUChange):
    def __init__(self, otu_change, sequences, old, otu_id):
        super().__init__(
            otu_change, sequences, HistoryMethod.update, old, otu_id=otu_id
        )


class OTUInsert(OTUChange):
    def __init__(self, otu_change, sequences):
        super().__init__(otu_change, sequences, HistoryMethod.create)


class OTUDelete(OTUChange):
    def __init__(self, otu_change, sequences, old, reference_update, otu_id):
        super().__init__(
            otu_change, sequences, HistoryMethod.remove, old, otu_id=otu_id
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
class DBUpdate:
    update: Union[UpdateOne, DeleteOne, DeleteMany, dict]
    post_update: Optional[Callable[[Any], Coroutine]] = None


@dataclass
class DataChunk:
    data: List[DBUpdate]
    bulk_function: Callable[[Any], Coroutine]


@dataclass
class OTUData:
    old: dict
    otu: Document
