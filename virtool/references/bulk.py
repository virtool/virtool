import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import List, Union, Coroutine, Callable, Any, Optional, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import UpdateOne, DeleteOne, DeleteMany
from virtool_core.models.enums import HistoryMethod

import virtool.history.db
from virtool.history.utils import compose_remove_description

from virtool.mongo.identifier import AbstractIdProvider
from virtool.otus.db import join
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper

if TYPE_CHECKING:
    from virtool.mongo.core import DB, Collection


@dataclass
class HistoryChange:
    verb: HistoryMethod
    otu_id: str
    old: Optional[dict] = None


@dataclass
class OTUUpdate:
    old: dict
    otu_update: UpdateOne
    sequence_updates: List[UpdateOne]
    sequence_inserts: List[dict]
    _update_history: Callable[[HistoryChange], Coroutine]

    def __post_init__(self):
        self.is_otu_updated: bool = False
        self.sequences_updated: int = 0
        self.expected_sequences_updated = len(self.sequence_updates) + len(
            self.sequence_inserts
        )

    async def otu_updated(self):
        self.is_otu_updated = True
        await self.update_history()

    async def sequence_updated(self):
        self.sequences_updated += 1
        await self.update_history()

    @property
    def is_complete(self):
        return (
            self.is_otu_updated
            and self.sequences_updated == self.expected_sequences_updated
        )

    async def update_history(self):
        if self.is_complete:
            await self._update_history(
                HistoryChange(HistoryMethod.update, self.old["_id"], old=self.old)
            )


@dataclass
class OTUInsert:
    otu_insert: dict
    sequence_inserts: List[dict]
    _update_history: Callable[[HistoryChange], Coroutine]

    def __post_init__(self):
        self.otu_id: str = ""
        self.is_otu_inserted: bool = False
        self.sequences_inserted: int = 0

    async def otu_inserted(self, otu_id: str):
        self.is_otu_inserted = True
        self.otu_id = otu_id
        await self.update_history()

    async def sequence_inserted(self, *args):
        self.sequences_inserted += 1
        await self.update_history()

    @property
    def is_complete(self):
        return self.is_otu_inserted and self.sequences_inserted == len(
            self.sequence_inserts
        )

    async def update_history(self):
        if self.is_complete:
            await self._update_history(HistoryChange(HistoryMethod.create, self.otu_id))


@dataclass
class HistoryUpdater:
    data_path: Path
    mongo: "DB"
    user_id: str
    session: AsyncIOMotorClientSession
    progress_tracker: AccumulatingProgressHandlerWrapper

    async def add(self, change: HistoryChange):
        joined = await join(self.mongo, change.otu_id, session=self.session)

        name = joined["name"]

        e = "" if change.verb.value[-1] == "e" else "e"

        description = f"{change.verb.value.capitalize()}{e}d {name}"

        if abbreviation := joined.get("abbreviation"):
            description = f"{description} ({abbreviation})"
        await virtool.history.db.add(
            self.mongo,
            self.data_path,
            change.verb,
            change.old,
            joined,
            description,
            self.user_id,
            silent=True,
            session=self.session,
        )
        await self.progress_tracker.add(1)
        print(self.progress_tracker._accumulated)

    async def delete(self, change: HistoryChange):
        description = compose_remove_description(change.old)
        await virtool.history.db.add(
            self.mongo,
            self.data_path,
            HistoryMethod.remove,
            change.old,
            None,
            description,
            self.user_id,
            session=self.session,
        )
        await self.progress_tracker.add(1)
        print(self.progress_tracker._accumulated)


@dataclass
class DBUpdate:
    update: Union[UpdateOne, DeleteOne, DeleteMany, dict]
    post_update: Callable[[Any], Coroutine]


class DBUpdateBuffer:
    def __init__(self, buffer_function, session: AsyncIOMotorClientSession):
        self.update_buffer = []
        self.buffer_function = buffer_function
        self.session = session

    async def add(self, update: DBUpdate):
        self.update_buffer.append(update)

        if len(self.update_buffer) >= 5:
            update_test = self.update_buffer
            self.update_buffer = []
            await self.flush(update_test)

    async def flush(self, buffer):
        await self.buffer_function(buffer, session=self.session)
        print("flush complete!")
        # self.update_buffer.clear()

    @staticmethod
    def insert_buffer(collection: "Collection", id_provider: AbstractIdProvider):
        async def func(change_buffer: List[DBUpdate], session):
            updates = await DBUpdateBuffer.generate_id_buffer(
                collection, change_buffer, id_provider, session
            )
            await collection.insert_many(
                [item.update for item in updates], session=session
            )
            for update in updates:
                await update.post_update(update.update["_id"])

        return func

    @staticmethod
    async def generate_id_buffer(
        collection: "Collection",
        change_buffer: List[DBUpdate],
        id_provider: AbstractIdProvider,
        session,
    ):
        id_update_buffer = [
            DBUpdate(
                {**update.update, "_id": id_provider.get()},
                update.post_update,
            )
            for update in change_buffer
        ]
        print("before find_one", len(change_buffer))
        if await collection.find_one(
            {"_id": {"$in": [update.update["_id"] for update in id_update_buffer]}},
            session=session,
        ):
            print("recursion time")
            return await DBUpdateBuffer.generate_id_buffer(
                collection, change_buffer, id_provider, session
            )
        print("after find_one")
        return id_update_buffer

    @staticmethod
    def update_buffer(collection: "Collection"):
        async def func(change_buffer: List[DBUpdate], session):
            await collection.bulk_write(
                [item.update for item in change_buffer], session=session
            )
            for update in change_buffer:
                await update.post_update()

        return func

    @staticmethod
    def delete_buffer(collection: "Collection"):
        async def func(change_buffer: List[DBUpdate], session):
            await collection.bulk_write(
                [change.update for change in change_buffer], session=session
            )
            for update in change_buffer:
                await update.post_update()

        return func


@dataclass
class OTUDelete:
    otu_delete: DeleteOne
    sequences_delete: DeleteMany
    reference_update: UpdateOne
    old: dict
    _update_history: Callable[[HistoryChange], Coroutine]

    def __post_init__(self):
        self.is_otu_deleted = False
        self.is_sequences_deleted = False
        self.is_reference_updated = False

    async def otu_deleted(self):
        self.is_otu_deleted = True
        await self.update_history()

    async def sequences_deleted(self):
        self.is_sequence_deleted = True
        await self.update_history()

    async def reference_updated(self):
        self.is_reference_updated = True
        await self.update_history()

    @property
    def is_complete(self):
        return (
            self.is_otu_deleted
            and self.is_sequences_deleted
            and self.is_reference_updated
        )

    async def update_history(self):
        if self.is_complete:
            await self._update_history(
                HistoryChange(HistoryMethod.remove, self.old["_id"], old=self.old)
            )


class BulkDeleter:
    def __init__(self, mongo: "DB", session: AsyncIOMotorClientSession):
        self.delete_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.delete_buffer(mongo.sequences), session
        )
        self.delete_otus_buffer = DBUpdateBuffer(
            DBUpdateBuffer.delete_buffer(mongo.otus), session
        )
        self.update_references_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.references), session
        )

    async def add(self, otu_delete: OTUDelete):
        await self.delete_sequence_buffer.add(
            DBUpdate(otu_delete.sequences_delete, otu_delete.sequences_deleted)
        )
        await self.delete_otus_buffer.add(
            DBUpdate(otu_delete.otu_delete, otu_delete.otu_deleted)
        )
        await self.update_references_buffer.add(
            DBUpdate(otu_delete.reference_update, otu_delete.reference_updated)
        )

    async def flush(self):
        await asyncio.gather(
            self.delete_sequence_buffer.flush(),
            self.delete_otus_buffer.flush(),
            self.update_references_buffer.flush(),
        )


class BulkUpdater:
    def __init__(self, mongo: "DB", session: AsyncIOMotorClientSession):
        self.update_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.sequences), session
        )
        self.insert_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.insert_buffer(mongo.sequences, mongo.id_provider), session
        )
        self.update_otu_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.otus), session
        )
        self.insert_otu_buffer = DBUpdateBuffer(
            DBUpdateBuffer.insert_buffer(mongo.otus, mongo.id_provider), session
        )

    async def update(self, update: OTUUpdate):
        for sequence_update in update.sequence_updates:
            await self.update_sequence_buffer.add(
                DBUpdate(sequence_update, update.sequence_updated)
            )
        for sequence_insert in update.sequence_inserts:
            await self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, update.sequence_updated)
            )
        await self.update_otu_buffer.add(
            DBUpdate(update.otu_update, update.otu_updated)
        )

    async def insert(self, update: OTUInsert):
        for sequence_insert in update.sequence_inserts:
            await self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, update.sequence_inserted)
            )
        await self.insert_otu_buffer.add(
            DBUpdate(update.otu_insert, update.otu_inserted)
        )

    async def flush(self):
        await asyncio.gather(
            self.update_sequence_buffer.flush(),
            self.update_otu_buffer.flush(),
            self.insert_sequence_buffer.flush(),
            self.insert_otu_buffer.flush(),
        )
