import asyncio
from asyncio import FIRST_COMPLETED, CancelledError, Queue
from datetime import datetime
from pathlib import Path
from typing import Callable

from motor.motor_asyncio import AsyncIOMotorClientSession

from virtool.history.db import prepare_add
from virtool.mongo.core import Collection, Mongo
from virtool.mongo.identifier import AbstractIdProvider
from virtool.otus.db import bulk_join_ids, bulk_join_query
from virtool.references.bulk_models import (
    BufferData,
    DataChunk,
    DBBufferData,
    OTUChange,
    OTUData,
    OTUDelete,
    OTUInsert,
    OTUUpdate,
    OTUUpdateBufferData,
)
from virtool.references.db import (
    bulk_prepare_update_joined_otu,
    prepare_insert_otu,
    prepare_remove_otu,
)
from virtool.tasks.progress import AccumulatingProgressHandlerWrapper
from virtool.types import Document

WORKER_COUNT = 25


class WorkerPool:
    def __init__(
        self,
        queue: Queue,
        session: AsyncIOMotorClientSession,
    ):
        self._queue = queue
        self._session = session
        self._workers = [asyncio.create_task(self._work()) for _ in range(WORKER_COUNT)]

    async def _work(self):
        while True:
            try:
                update_chunk = await self._queue.get()

                await update_chunk.bulk_function(
                    update_chunk.data,
                    self._session,
                )

                self._queue.task_done()
            except CancelledError:
                break

    async def close(self):
        join_task = asyncio.create_task(self._queue.join())

        await asyncio.wait([join_task, *self._workers], return_when=FIRST_COMPLETED)

        if exceptions := [
            worker.exception() for worker in self._workers if worker.done()
        ]:
            raise exceptions[0]

        for worker in self._workers:
            worker.cancel()


class BaseDataBuffer:
    def __init__(self, update_function: Callable, queue: Queue):
        self._buffer = []
        self.update_function = update_function
        self.queue = queue
        self.flush_buffer = False

    def add(self, data: BufferData):
        self._buffer.append(data)
        self.flush()

    def extend(self, updates: list[BufferData]):
        if updates is not None:
            self._buffer.extend(updates)
            self.flush()

    def flush(self):
        if len(self._buffer) >= 25 or self.flush_buffer:
            self.queue.put_nowait(
                DataChunk(self._buffer, self.update_function),
            )
            self._buffer = []

    async def finish(self):
        if self._buffer:
            await self.queue.put(
                DataChunk(self._buffer, self.update_function),
            )
            self._buffer = []

        self.flush_buffer = True


class OTUDataBuffer(BaseDataBuffer):
    @classmethod
    def insert_buffer(
        cls,
        task_queue: Queue,
        collection: "Collection",
        id_provider: AbstractIdProvider,
    ):
        async def func(
            change_buffer: list[BufferData],
            session: AsyncIOMotorClientSession,
        ):
            updates = [
                DBBufferData({**update.data, "_id": id_provider.get()}, update.callback)
                for update in change_buffer
            ]

            await collection.insert_many(
                [item.data for item in updates],
                session=session,
            )

            for update in updates:
                await update.callback(update.data["_id"])

        return cls(func, task_queue)

    @classmethod
    def update_buffer(cls, task_queue: Queue, collection: "Collection"):
        async def func(
            change_buffer: list[BufferData],
            session: AsyncIOMotorClientSession,
        ):
            await collection.bulk_write(
                [item.data for item in change_buffer],
                session=session,
            )
            for update in change_buffer:
                await update.callback()

        return cls(func, task_queue)

    @classmethod
    def delete_buffer(cls, task_queue: Queue, collection: "Collection"):
        async def func(
            change_buffer: list[BufferData],
            session: AsyncIOMotorClientSession,
        ):
            await collection.bulk_write(
                [change.data for change in change_buffer],
                session=session,
            )
            for update in change_buffer:
                await update.callback()

        return cls(func, task_queue)

    @classmethod
    def history_insert_buffer(cls, task_queue: Queue, collection: "Collection"):
        async def func(
            change_buffer: list[BufferData],
            session: AsyncIOMotorClientSession,
        ):
            await collection.insert_many(
                [item.data for item in change_buffer],
                session=session,
            )

        return cls(func, task_queue)


class OTUDataBulkUpdater:
    def __init__(
        self,
        mongo: "Mongo",
        user_id: str,
        progress_tracker: AccumulatingProgressHandlerWrapper,
        task_queue: Queue,
        prepare_history: Callable,
    ):
        self.user_id = user_id
        self.progress_tracker = progress_tracker
        self.prepare_history = prepare_history

        self.update_sequence_buffer = OTUDataBuffer.update_buffer(
            task_queue,
            mongo.sequences,
        )

        self.insert_sequence_buffer = OTUDataBuffer.insert_buffer(
            task_queue,
            mongo.sequences,
            mongo.id_provider,
        )
        self.update_otu_buffer = OTUDataBuffer.update_buffer(task_queue, mongo.otus)
        self.insert_otu_buffer = OTUDataBuffer.insert_buffer(
            task_queue,
            mongo.otus,
            mongo.id_provider,
        )
        self.delete_sequence_buffer = OTUDataBuffer.delete_buffer(
            task_queue,
            mongo.sequences,
        )
        self.delete_otus_buffer = OTUDataBuffer.delete_buffer(task_queue, mongo.otus)
        self.update_references_buffer = OTUDataBuffer.update_buffer(
            task_queue,
            mongo.references,
        )
        self.update_history_buffer = OTUDataBuffer.history_insert_buffer(
            task_queue,
            mongo.history,
        )

    def update(self, updates: list[OTUUpdate]):
        for update in updates:
            self.update_otu_buffer.add(
                DBBufferData(update.otu_change, self._otu_changed(update)),
            )

    def insert(self, update: OTUInsert):
        self.insert_otu_buffer.add(
            DBBufferData(update.otu_change, self._otu_changed(update)),
        )

    def delete(self, otu_delete: OTUDelete):
        self.delete_otus_buffer.add(
            DBBufferData(otu_delete.otu_change, self._otu_changed(otu_delete)),
        )
        self.update_references_buffer.add(
            DBBufferData(
                otu_delete.reference_update,
                self._reference_updated(otu_delete),
            ),
        )

    async def insert_history(self, history_inserts: list[Document]):
        for history_insert in history_inserts:
            self.update_history_buffer.add(DBBufferData(history_insert))
        await self.progress_tracker.add(len(history_inserts))

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

    def _otu_changed(self, otu_change: OTUChange):
        async def func(otu_id: str = None):
            otu_change.otu_changed = True
            if otu_change.otu_id is None:
                otu_change.otu_id = otu_id

            self._insert_sequences(otu_change)

        return func

    def _insert_sequences(self, otu_change: OTUChange):
        for sequence_update in otu_change.sequences.updates:
            self.update_sequence_buffer.add(
                DBBufferData(sequence_update, self._sequence_updated(otu_change)),
            )
        for sequence_insert in otu_change.sequences.inserts:
            self.insert_sequence_buffer.add(
                DBBufferData(
                    {**sequence_insert, "otu_id": otu_change.otu_id},
                    self._sequence_updated(otu_change),
                ),
            )
        for sequence_delete in otu_change.sequences.deletes:
            self.delete_sequence_buffer.add(
                DBBufferData(sequence_delete, self._sequence_updated(otu_change)),
            )

    def _sequence_updated(self, otu_change: OTUChange):
        async def func(*args):
            otu_change.remaining_sequence_changes -= 1
            if otu_change.is_complete:
                await self.prepare_history(otu_change)

        return func

    def _reference_updated(self, otu_change: OTUChange):
        async def func():
            otu_change.is_reference_updated = True
            if otu_change.is_complete:
                await self.prepare_history(otu_change)

        return func


class OTUUpdateBuffer(BaseDataBuffer):
    @classmethod
    def prepare_upsert_buffer(
        cls,
        task_queue: Queue,
        update_db: OTUDataBulkUpdater,
        prepare_otu_update_buffer: BaseDataBuffer,
        mongo: "Mongo",
        ref_id: str,
        user_id: str,
        created_at: datetime,
    ):
        async def func(data: list[OTUUpdateBufferData], session):
            old_otus = await bulk_join_query(
                mongo,
                {
                    "reference.id": ref_id,
                    "remote.id": {"$in": [otu.data["_id"] for otu in data]},
                },
                session=session,
            )

            old_otus = {otu["remote"]["id"]: otu for otu in old_otus}
            for item in data:
                otu = item.data
                if otu["_id"] in old_otus:
                    prepare_otu_update_buffer.add(OTUData(old_otus[otu["_id"]], otu))
                else:
                    insert_otu = prepare_insert_otu(otu, created_at, ref_id, user_id)
                    update_db.insert(insert_otu)

        return cls(func, task_queue)

    @classmethod
    def prepare_update_buffer(
        cls,
        task_queue: Queue,
        bulk_db_updater: OTUDataBulkUpdater,
        mongo: "Mongo",
        ref_id: str,
    ):
        async def func(otu_data: list[OTUData], session):
            updates = await bulk_prepare_update_joined_otu(
                mongo,
                otu_data,
                ref_id,
                session,
            )
            if updates:
                bulk_db_updater.update(updates)

        return cls(func, task_queue)

    @classmethod
    def prepare_insert_history_buffer(
        cls,
        task_queue: Queue,
        bulk_db_updater: OTUDataBulkUpdater,
        mongo: "Mongo",
        user_id: str,
        data_path: Path,
    ):
        async def func(
            data: list[OTUUpdateBufferData],
            session: AsyncIOMotorClientSession,
        ):
            docs = [
                otu_data.data.otu_id
                for otu_data in data
                if otu_data.data.history_method == "update"
                or otu_data.data.history_method == "create"
            ]

            joined_documents = await bulk_join_ids(mongo, docs, session)
            joined_documents = {
                document["_id"]: document for document in joined_documents
            }

            inserts = [
                await prepare_add(
                    otu_data.data.history_method,
                    otu_data.data.old,
                    joined_documents.get(otu_data.data.otu_id),
                    user_id,
                    data_path,
                )
                for otu_data in data
            ]
            await bulk_db_updater.insert_history(inserts)

        return cls(func, task_queue)


class BulkOTUUpdater:
    def __init__(
        self,
        mongo: "Mongo",
        ref_id: str,
        user_id: str,
        created_at: datetime,
        data_path: Path,
        progress_tracker: AccumulatingProgressHandlerWrapper,
        session: AsyncIOMotorClientSession,
    ):
        self.session = session
        self.mongo = mongo
        self.created_at = created_at
        self.ref_id = ref_id
        self.user_id = user_id
        self.task_queue = asyncio.Queue()
        self.worker_pool = WorkerPool(self.task_queue, session)

        self.update_db = OTUDataBulkUpdater(
            mongo,
            user_id,
            progress_tracker,
            self.task_queue,
            self._insert_history,
        )
        self.prepare_otu_update_buffer = OTUUpdateBuffer.prepare_update_buffer(
            self.task_queue,
            self.update_db,
            mongo,
            ref_id,
        )

        self.prepare_insert_history_buffer = (
            OTUUpdateBuffer.prepare_insert_history_buffer(
                self.task_queue,
                self.update_db,
                mongo,
                user_id,
                data_path,
            )
        )

        self.prepare_upsert_buffer = OTUUpdateBuffer.prepare_upsert_buffer(
            self.task_queue,
            self.update_db,
            self.prepare_otu_update_buffer,
            mongo,
            ref_id,
            user_id,
            created_at,
        )

    def bulk_upsert(self, otus: list[dict]):
        for otu in otus:
            self.prepare_upsert_buffer.add(OTUUpdateBufferData(otu))

    def bulk_insert(self, otus: list[dict]):
        for otu in otus:
            insert_otu = prepare_insert_otu(
                otu,
                self.created_at,
                self.ref_id,
                self.user_id,
            )
            self.update_db.insert(insert_otu)

    async def delete(self, otu_id: str):
        remove_otu = await prepare_remove_otu(self.mongo, otu_id, self.session)
        if remove_otu:
            self.update_db.delete(remove_otu)

    async def finish(self):
        await asyncio.gather(
            self.prepare_upsert_buffer.finish(),
            self.prepare_otu_update_buffer.finish(),
            self.prepare_insert_history_buffer.finish(),
            self.update_db.finish(),
        )

        await self.worker_pool.close()

    async def _insert_history(self, otu_change: OTUChange):
        self.prepare_insert_history_buffer.add(OTUUpdateBufferData(otu_change))
