import asyncio
from asyncio import Queue
from dataclasses import dataclass
from pathlib import Path
from typing import List, Union, Coroutine, Callable, Any, Optional, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import UpdateOne, DeleteOne, DeleteMany
from pymongo.errors import BulkWriteError
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
    description: str
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

    async def sequence_updated(self, *args):
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


@dataclass
class DBUpdateChunk:
    updates: List[DBUpdate]
    update_function: Callable[[Any], Coroutine]


class DBUpdateWorker:
    def __init__(self, task_queue: Queue, session):
        self.task_queue = task_queue
        self.session = session

    async def run(self):
        while True:
            update_chunk = await self.task_queue.get()
            await update_chunk.update_function(
                update_chunk.updates, session=self.session
            )
            self.task_queue.task_done()


class DBUpdateBuffer:
    def __init__(self, update_function, task_queue: Queue):
        self.update_buffer = []
        self.update_function = update_function
        self.task_queue = task_queue

    def add(self, update: DBUpdate):
        self.update_buffer.append(update)
        if len(self.update_buffer) >= 25:
            self.flush()

    def flush(self):
        if self.update_buffer:
            self.task_queue.put_nowait(
                DBUpdateChunk(self.update_buffer, self.update_function)
            )
            self.update_buffer = []

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
        if await collection.find_one(
            {"_id": {"$in": [update.update["_id"] for update in id_update_buffer]}},
            session=session,
        ):
            print("Recursion time uh oh")
            return await DBUpdateBuffer.generate_id_buffer(
                collection, change_buffer, id_provider, session
            )
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

    @staticmethod
    def history_insert_buffer(collection: "Collection", id_provider):
        async def func(change_buffer: List[DBUpdate], session):
            updates = await DBUpdateBuffer.generate_id_buffer(
                collection, change_buffer, id_provider, session
            )
            try:
                await collection.insert_many(
                    [item.update for item in updates], session=session
                )
            except BulkWriteError as e:
                for writeError in e["writeErrors"]:
                    print(writeError)
                    # await write_diff_file(data_path, otu_id, otu_version, document["diff"])
            for update in updates:
                await update.post_update(update.update["_id"])

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


class BulkUpdater:
    def __init__(self, mongo: "DB", session: AsyncIOMotorClientSession):
        self.task_queue = asyncio.Queue()
        self.update_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.sequences), self.task_queue
        )
        self.insert_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.insert_buffer(mongo.sequences, mongo.id_provider),
            self.task_queue,
        )
        self.update_otu_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.otus), self.task_queue
        )
        self.insert_otu_buffer = DBUpdateBuffer(
            DBUpdateBuffer.insert_buffer(mongo.otus, mongo.id_provider), self.task_queue
        )
        self.delete_sequence_buffer = DBUpdateBuffer(
            DBUpdateBuffer.delete_buffer(mongo.sequences), self.task_queue
        )
        self.delete_otus_buffer = DBUpdateBuffer(
            DBUpdateBuffer.delete_buffer(mongo.otus), self.task_queue
        )
        self.update_references_buffer = DBUpdateBuffer(
            DBUpdateBuffer.update_buffer(mongo.references), self.task_queue
        )

        self.workers = [
            asyncio.create_task(DBUpdateWorker(self.task_queue, session).run())
            for _ in range(5)
        ]

    async def update(self, update: OTUUpdate):
        for sequence_update in update.sequence_updates:
            self.update_sequence_buffer.add(
                DBUpdate(sequence_update, update.sequence_updated)
            )
        for sequence_insert in update.sequence_inserts:
            self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, update.sequence_updated)
            )
        self.update_otu_buffer.add(DBUpdate(update.otu_update, update.otu_updated))

    async def insert(self, update: OTUInsert):
        for sequence_insert in update.sequence_inserts:
            self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, update.sequence_inserted)
            )
        self.insert_otu_buffer.add(DBUpdate(update.otu_insert, update.otu_inserted))

    async def delete(self, otu_delete: OTUDelete):
        self.delete_sequence_buffer.add(
            DBUpdate(otu_delete.sequences_delete, otu_delete.sequences_deleted)
        )
        self.delete_otus_buffer.add(
            DBUpdate(otu_delete.otu_delete, otu_delete.otu_deleted)
        )
        self.update_references_buffer.add(
            DBUpdate(otu_delete.reference_update, otu_delete.reference_updated)
        )

    async def update_history(self, history_update):

        self.update_history_buffer.add()

    def increment_sequence(self, otu_change):
        ...

    def otu_updated(self, otu_change):
        ...

    async def finish(self):
        self.update_sequence_buffer.flush()
        self.update_otu_buffer.flush()
        self.insert_sequence_buffer.flush()
        self.insert_otu_buffer.flush()
        self.delete_sequence_buffer.flush()
        self.delete_otus_buffer.flush()
        self.update_references_buffer.flush()

        await self.task_queue.join()

        for worker in self.workers:
            worker.cancel()
