import asyncio
from asyncio import Queue
from dataclasses import dataclass, astuple
from pathlib import Path
from typing import List, Union, Coroutine, Callable, Any, Optional, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import UpdateOne, DeleteOne, DeleteMany, InsertOne
from pymongo.errors import BulkWriteError
from virtool_core.models.enums import HistoryMethod

import virtool.history.db
from virtool.history.db import prepare_add
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
    otu_id: Optional[dict] = None

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
            print("update_session", session)
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
    def history_insert_buffer(collection: "Collection"):
        async def func(change_buffer: List[DBUpdate], session):
            try:
                await collection.insert_many(
                    [item.update for item in change_buffer], session=session
                )
            except BulkWriteError as e:
                print(e)
                # for writeError in e["writeErrors"]:

                # await write_diff_file(data_path, otu_id, otu_version, document["diff"])
                raise

        return func


class BulkUpdater:
    def __init__(
        self,
        mongo: "DB",
        session: AsyncIOMotorClientSession,
        user_id: str,
        progress_tracker: AccumulatingProgressHandlerWrapper,
    ):
        self.user_id = user_id
        self.session = session
        self.mongo = mongo
        self.progress_tracker = progress_tracker
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

        self.update_history_buffer = DBUpdateBuffer(
            DBUpdateBuffer.history_insert_buffer(mongo.history), self.task_queue
        )
        self.flag = True

        self.workers = [
            asyncio.create_task(DBUpdateWorker(self.task_queue, self.session).run())
            for _ in range(5)
        ]

    async def update(self, update: OTUUpdate):
        for sequence_update in update.sequences.updates:
            self.update_sequence_buffer.add(
                DBUpdate(sequence_update, self.increment_sequence(update))
            )
        for sequence_insert in update.sequences.inserts:
            self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, self.increment_sequence(update))
            )
        self.update_otu_buffer.add(
            DBUpdate(update.otu_change, self.otu_updated(update))
        )

    async def insert(self, update: OTUInsert):
        for sequence_insert in update.sequences.inserts:
            self.insert_sequence_buffer.add(
                DBUpdate(sequence_insert, self.increment_sequence(update))
            )
        self.insert_otu_buffer.add(
            DBUpdate(update.otu_change, self.otu_updated(update))
        )

    async def delete(self, otu_delete: OTUDelete):
        for sequence_delete in otu_delete.sequences.deletes:
            self.delete_sequence_buffer.add(
                DBUpdate(sequence_delete, self.increment_sequence(otu_delete))
            )
        self.delete_otus_buffer.add(
            DBUpdate(otu_delete.otu_change, self.otu_updated(otu_delete))
        )
        self.update_references_buffer.add(
            DBUpdate(otu_delete.reference_update, self.reference_updated(otu_delete))
        )

    async def update_history(self, otu_change: OTUChange):
        history_method = otu_change.history_method
        new = None
        if history_method == "update" or history_method == "create":
            new = await join(self.mongo, otu_change.otu_id, session=self.session)
            if history_method == "update" and self.flag:
                self.flag = False
                print(
                    history_method,
                    new["version"],
                    self.session,
                    otu_change.otu_id,
                    otu_change.old["_id"],
                    new["_id"],
                )
        self.update_history_buffer.add(
            DBUpdate(
                await prepare_add(
                    history_method,
                    otu_change.old,
                    new,
                    self.user_id,
                )
            )
        )
        await self.progress_tracker.add(1)
        if self.progress_tracker._accumulated % 100 == 0:
            print(self.progress_tracker._accumulated)

    def increment_sequence(self, otu_change: OTUChange):
        async def func(*args):
            otu_change.remaining_sequence_changes -= 1
            if otu_change.is_complete:
                await self.update_history(otu_change)

        return func

    def otu_updated(self, otu_change: OTUChange):
        async def func(otu_id: str = None):
            otu_change.otu_changed = True
            if otu_change.otu_id is None:
                otu_change.otu_id = otu_id
            if otu_change.is_complete:
                await self.update_history(otu_change)

        return func

    def reference_updated(self, otu_change: OTUChange):
        async def func():
            otu_change.reference_update = True
            if otu_change.is_complete:
                await self.update_history(otu_change)

        return func

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
