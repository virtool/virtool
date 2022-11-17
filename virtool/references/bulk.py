import asyncio
from dataclasses import dataclass
from typing import List, Union, Coroutine, Callable

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import UpdateOne
from virtool_core.models.enums import HistoryMethod

from virtool.mongo.core import DB
from virtool.otus.db import join
from virtool.references.db import insert_change


@dataclass
class OTUUpdate:
    old: dict
    otu_update: UpdateOne
    sequence_updates: List[UpdateOne]
    sequence_inserts: List[dict]
    _update_history: Callable[[..., any], Coroutine]
    is_otu_updated: bool = False
    sequences_updated: int = 0

    def __post_init__(self):
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
            self._update_history(
                HistoryChange(
                    self.old,
                    HistoryMethod.update,
                )
            )


@dataclass
class OTUInsert:
    otu_insert: dict
    sequence_inserts: List[dict]
    is_otu_inserted: bool = False
    sequences_inserted: int = 0

    async def otu_inserted(self):
        self.is_otu_inserted = True
        await self.update_history()

    async def sequence_inserted(self):
        self.sequence_inserted += 1
        await self.update_history()

    async def update_history(self):
        if self.is_otu_inserted and self.sequences_inserted == len(
            self.sequence_inserts
        ):
            ...


@dataclass
class HistoryChange:
    old: dict
    verb: HistoryMethod
    otu_id: str


class UpdateHistory:
    data_path: str
    mongo: "DB"
    user_id: str
    session: AsyncIOMotorClientSession

    def add(self, change: HistoryChange):
        insert_change(
            self.data_path,
            self.mongo,
            change.otu_id,
            change.verb,
            self.user_id,
            session=self.session,
            old=change.old,
        )


@dataclass
class DBUpdate:
    update: Union[UpdateOne, dict, str]
    post_update: Coroutine


class DBUpdateBuffer:
    def __init__(self, db_function, session: AsyncIOMotorClientSession):
        self.update_buffer = []
        self.db_function = db_function
        self.session = session

    async def add(self, update: DBUpdate):
        self.update_buffer.append(update)

        if len(self.update_buffer) >= 25:
            await self.flush()

    async def flush(self):
        results = await self.db_function(
            [item.update for item in self.update_buffer], session=self.session
        )
        for update in self.update_buffer:
            await update.post_update()
        self.update_buffer.clear()
        return results


class BulkUpdater:
    def __init__(self, mongo: DB, session: AsyncIOMotorClientSession):
        self.update_sequence_buffer = DBUpdateBuffer(
            mongo.sequences.bulk_write, session
        )
        self.insert_sequence_buffer = DBUpdateBuffer(
            mongo.sequences.insert_many, session
        )
        self.update_otu_buffer = DBUpdateBuffer(mongo.otus.bulk_write, session)
        self.insert_otu_buffer = DBUpdateBuffer(mongo.otus.insert_many, session)

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


class BulkDeleter:
    ...
