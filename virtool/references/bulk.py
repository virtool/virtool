import asyncio
from asyncio import Queue
from typing import List, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.errors import BulkWriteError

from virtool.history.db import prepare_add
from virtool.mongo.identifier import AbstractIdProvider
from virtool.otus.db import join, bulk_join_ids, bulk_join_query
from virtool.references.bulk_models import (
    DBUpdate,
    DataChunk,
    OTUUpdate,
    OTUInsert,
    OTUDelete,
    OTUChange,
    OTUData,
    SequenceChanges,
)
from virtool.references.db import (
    bulk_prepare_update_joined_otu,
    prepare_insert_otu,
    prepare_remove_otu,
)
from virtool.references.utils import ReferenceSourceData
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper
from virtool.types import Document

if TYPE_CHECKING:
    from virtool.mongo.core import DB, Collection


class Worker:
    def __init__(self, task_queue: Queue, session, queue_tracker):
        self.task_queue = task_queue
        self.session = session
        self.q_tracker = queue_tracker

    async def run(self):
        while True:
            update_chunk = await self.task_queue.get()
            await update_chunk.bulk_function(update_chunk.data, session=self.session)
            self.task_queue.task_done()
            self.q_tracker.add(self.task_queue.qsize())


class DataBuffer:
    def __init__(self, update_function, task_queue: Queue):
        self.update_buffer = []
        self.update_function = update_function
        self.task_queue = task_queue
        self.no_buffer = False

    def add(self, data: DBUpdate):
        self.update_buffer.append(data)
        self.flush()

    def extend(self, updates: List[DBUpdate]):
        if updates is not None:
            self.update_buffer.extend(updates)
            self.flush()

    def flush(self):
        if len(self.update_buffer) >= 50 or self.no_buffer:
            self.task_queue.put_nowait(
                DataChunk(self.update_buffer, self.update_function)
            )
            self.update_buffer = []

    async def finish(self):
        if self.update_buffer:
            await self.task_queue.put(
                DataChunk(self.update_buffer, self.update_function)
            )
            self.update_buffer = []
        self.no_buffer = True

    @staticmethod
    def bulk_insert(collection: "Collection", id_provider: AbstractIdProvider):
        async def func(change_buffer: List[DBUpdate], session):
            updates = await DataBuffer.generate_bulk_id_buffer(
                collection, change_buffer, id_provider, session
            )
            await collection.insert_many(
                [item.update for item in updates], session=session
            )
            for update in updates:
                await update.post_update(update.update["_id"])

        return func

    @staticmethod
    async def generate_bulk_id_buffer(
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
            return await DataBuffer.generate_bulk_id_buffer(
                collection, change_buffer, id_provider, session
            )
        return id_update_buffer

    @staticmethod
    def bulk_update(collection: "Collection"):
        async def func(change_buffer: List[DBUpdate], session):
            await collection.bulk_write(
                [item.update for item in change_buffer], session=session
            )
            for update in change_buffer:
                await update.post_update()

        return func

    @staticmethod
    def bulk_delete(collection: "Collection"):
        async def func(change_buffer: List[DBUpdate], session):
            await collection.bulk_write(
                [change.update for change in change_buffer], session=session
            )
            for update in change_buffer:
                await update.post_update()

        return func

    @staticmethod
    def bulk_insert_history(collection: "Collection"):
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


class DBBulkUpdater:
    def __init__(
        self,
        mongo: "DB",
        session: AsyncIOMotorClientSession,
        user_id: str,
        progress_tracker: AccumulatingProgressHandlerWrapper,
        workers,
        task_queue,
        prepare_history,
    ):
        self.user_id = user_id
        self.session = session
        self.mongo = mongo
        self.progress_tracker = progress_tracker
        self.task_queue = task_queue
        self.workers = workers
        self.prepare_history = prepare_history

        self.update_sequence_buffer = DataBuffer(
            DataBuffer.bulk_update(mongo.sequences), self.task_queue
        )
        self.insert_sequence_buffer = DataBuffer(
            DataBuffer.bulk_insert(mongo.sequences, mongo.id_provider),
            self.task_queue,
        )
        self.update_otu_buffer = DataBuffer(
            DataBuffer.bulk_update(mongo.otus), self.task_queue
        )
        self.insert_otu_buffer = DataBuffer(
            DataBuffer.bulk_insert(mongo.otus, mongo.id_provider), self.task_queue
        )
        self.delete_sequence_buffer = DataBuffer(
            DataBuffer.bulk_delete(mongo.sequences), self.task_queue
        )
        self.delete_otus_buffer = DataBuffer(
            DataBuffer.bulk_delete(mongo.otus), self.task_queue
        )
        self.update_references_buffer = DataBuffer(
            DataBuffer.bulk_update(mongo.references), self.task_queue
        )

        self.update_history_buffer = DataBuffer(
            DataBuffer.bulk_insert_history(mongo.history), self.task_queue
        )

    def update(self, updates: List[OTUUpdate]):
        for update in updates:
            self.update_otu_buffer.add(
                DBUpdate(update.otu_change, self.otu_updated(update))
            )

    def insert(self, update: OTUInsert):
        self.insert_otu_buffer.add(
            DBUpdate(update.otu_change, self.otu_updated(update))
        )

    def delete(self, otu_delete: OTUDelete):
        self.delete_otus_buffer.add(
            DBUpdate(otu_delete.otu_change, self.otu_updated(otu_delete))
        )
        self.update_references_buffer.add(
            DBUpdate(otu_delete.reference_update, self.reference_updated(otu_delete))
        )

    async def insert_history(self, history_inserts: List[Document]):
        for history_insert in history_inserts:
            self.update_history_buffer.add(DBUpdate(history_insert))
        await self.progress_tracker.add(len(history_inserts))
        if self.progress_tracker._accumulated % 100 == 0:
            print(self.progress_tracker._accumulated)

    def increment_sequence(self, otu_change: OTUChange):
        async def func(*args):
            otu_change.remaining_sequence_changes -= 1
            if otu_change.is_complete:
                await self.prepare_history(otu_change)

        return func

    def add_sequences(self, otu_change: OTUChange):
        for sequence_update in otu_change.sequences.updates:
            self.update_sequence_buffer.add(
                DBUpdate(sequence_update, self.increment_sequence(otu_change))
            )
        for sequence_insert in otu_change.sequences.inserts:
            self.insert_sequence_buffer.add(
                DBUpdate(
                    {**sequence_insert, "otu_id": otu_change.otu_id},
                    self.increment_sequence(otu_change),
                )
            )
        for sequence_delete in otu_change.sequences.deletes:
            self.delete_sequence_buffer.add(
                DBUpdate(sequence_delete, self.increment_sequence(otu_change))
            )

    def otu_updated(self, otu_change: OTUChange):
        async def func(otu_id: str = None):
            otu_change.otu_changed = True
            if otu_change.otu_id is None:
                otu_change.otu_id = otu_id

            self.add_sequences(otu_change)

        return func

    def reference_updated(self, otu_change: OTUChange):
        async def func():
            otu_change.is_reference_updated = True
            if otu_change.is_complete:
                await self.prepare_history(otu_change)

        return func

    async def finish(self):
        await asyncio.gather(
            self.update_otu_buffer.finish(),
            self.insert_otu_buffer.finish(),
            self.delete_otus_buffer.finish(),
            self.update_references_buffer.finish(),
            self.update_sequence_buffer.finish(),
            self.insert_sequence_buffer.finish(),
            self.delete_sequence_buffer.finish(),
            self.update_history_buffer.finish(),
        )


class QTracker:
    def __init__(self):
        self.data_log = []

    def add(self, num_items: int):
        self.data_log.append(num_items)

    @property
    def average(self):
        return sum(self.data_log) / len(self.data_log)

    @property
    def highest(self):
        return max(self.data_log)

    @property
    def mode(self):
        return max(set(self.data_log), key=self.data_log.count)


class BulkOTUUpdater:
    def __init__(self, ref_id, user_id, mongo, progress_tracker, session, created_at):
        self.user_id = user_id
        self.session = session
        self.mongo = mongo
        self.ref_id = ref_id
        self.progress_tracker = progress_tracker
        self.task_queue = asyncio.Queue()
        self.q_tracker = QTracker()
        self.created_at = created_at
        self.workers = [
            asyncio.create_task(
                Worker(self.task_queue, self.session, self.q_tracker).run()
            )
            for _ in range(10)
        ]
        self.update_db = DBBulkUpdater(
            mongo,
            session,
            user_id,
            progress_tracker,
            self.workers,
            self.task_queue,
            self.insert_history,
        )
        self.prepare_otu_update_buffer = DataBuffer(
            BulkOTUUpdater.bulk_prepare_update(self.update_db, mongo, ref_id, self),
            self.task_queue,
        )
        self.prepare_insert_history_buffer = DataBuffer(
            BulkOTUUpdater.bulk_prepare_insert_history(
                self.update_db, mongo, self.user_id
            ),
            self.task_queue,
        )
        self.prepare_data_buffer = DataBuffer(
            BulkOTUUpdater.prepare_data(
                mongo, self.ref_id, self.update, self.insert, self.created_at
            ),
            self.task_queue,
        )

        self.all_changes = []
        self.inserts = 0
        self.updates = 0
        self.deletes = 0

    def bulk_upsert(self, otus: List[dict]):
        for otu in otus:
            self.prepare_data_buffer.add(otu)

    def insert(self, otu, created_at):
        insert_otu = prepare_insert_otu(otu, created_at, self.ref_id, self.user_id)
        self.update_db.insert(insert_otu)
        self.inserts += 1
        self.all_changes.append(insert_otu)

    def update(self, otu: dict, old: dict):
        self.prepare_otu_update_buffer.add(OTUData(old, otu))

    async def delete(self, otu_id):
        remove_otu = await prepare_remove_otu(self.mongo, otu_id, self.session)
        if remove_otu:
            self.deletes += 1
            self.update_db.delete(remove_otu)
            self.all_changes.append(remove_otu)

    async def insert_history(self, otu_change: OTUChange):
        self.prepare_insert_history_buffer.add(otu_change)

    async def finish(self):
        await asyncio.gather(
            self.prepare_data_buffer.finish(),
            self.prepare_otu_update_buffer.finish(),
            self.update_db.finish(),
            self.prepare_insert_history_buffer.finish(),
        )
        await self.task_queue.join()
        print(
            f"deletes {self.deletes}, updates {self.updates}, inserts{self.inserts}, total {self.deletes + self.inserts + self.updates}, remainder {self.task_queue.qsize()}, derped update {len(self.prepare_otu_update_buffer.update_buffer)}"
        )
        print(
            f"Queue states: Average: {self.q_tracker.average} highest: {self.q_tracker.highest} mode: {self.q_tracker.mode}"
        )
        print(
            len(self.update_db.update_otu_buffer.update_buffer),
            len(self.update_db.insert_otu_buffer.update_buffer),
            len(self.update_db.delete_otus_buffer.update_buffer),
            len(self.update_db.update_references_buffer.update_buffer),
            len(self.update_db.update_sequence_buffer.update_buffer),
            len(self.update_db.insert_sequence_buffer.update_buffer),
            len(self.update_db.delete_sequence_buffer.update_buffer),
            len(self.update_db.update_history_buffer.update_buffer),
            len(self.prepare_data_buffer.update_buffer),
            len(self.prepare_otu_update_buffer.update_buffer),
            len(self.prepare_insert_history_buffer.update_buffer),
        )
        for worker in self.workers:
            worker.cancel()

        for change in self.all_changes:
            if not change.is_complete:
                print(
                    change.history_method,
                    change.remaining_sequence_changes,
                    change.otu_changed,
                )

    @staticmethod
    def prepare_data(mongo, ref_id, update, insert, created_at):
        async def func(otus: List[dict], session):
            old_otus = await bulk_join_query(
                mongo,
                {
                    "reference.id": ref_id,
                    "remote.id": {"$in": [otu["_id"] for otu in otus]},
                },
                session=session,
            )

            old_otus = {otu["remote"]["id"]: otu for otu in old_otus}
            for otu in otus:
                if otu["_id"] in old_otus:
                    update(otu, old_otus[otu["_id"]])
                else:
                    insert(otu, created_at)

        return func

    @staticmethod
    def bulk_prepare_update(bulk_db_updater: DBBulkUpdater, mongo, ref_id, self):
        async def func(data: List[OTUData], session):
            updates = await bulk_prepare_update_joined_otu(mongo, data, ref_id, session)
            bulk_db_updater.update(updates)
            self.updates += len(updates)
            self.all_changes.extend(updates)

        return func

    @staticmethod
    def bulk_prepare_insert_history(bulk_db_updater: DBBulkUpdater, mongo, user_id):
        async def func(data: List[OTUChange], session):
            docs = [
                otu_change.otu_id
                for otu_change in data
                if otu_change.history_method == "update"
                or otu_change.history_method == "create"
            ]

            joined_documents = await bulk_join_ids(
                mongo,
                docs,
                session,
            )
            joined_documents = {
                document["_id"]: document for document in joined_documents
            }

            inserts = [
                prepare_add(
                    otu_change.history_method,
                    otu_change.old,
                    joined_documents.get(otu_change.otu_id),
                    user_id,
                )
                for otu_change in data
            ]
            await bulk_db_updater.insert_history(inserts)

        return func
