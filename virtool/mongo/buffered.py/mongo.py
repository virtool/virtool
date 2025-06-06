from contextlib import asynccontextmanager
from typing import List

from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo import InsertOne, UpdateOne


class BufferedBulkWriter:
    """
    Performs bulk writes against a MongoDB collection.

    """

    def __init__(
        self,
        collection,
        batch_size,
        session: AsyncIOMotorClientSession | None = None,
    ):
        self.collection = collection
        self.batch_size = batch_size
        self._buffer: List[InsertOne | UpdateOne] = []
        self._session = session

    async def add(self, request: InsertOne | UpdateOne):
        """
        Add a write request to the buffer.

        If the buffer has reached ``batch_size`` all requests will be sent to MongoDB
        and the buffer will be emptied.

        :param request: the request to add to the buffer

        """
        self._buffer.append(request)

        if len(self._buffer) == self.batch_size:
            await self.flush()

    async def flush(self):
        """
        Flush the buffered write requests to MongoDB.

        """
        if self._buffer:
            await self.collection.bulk_write(self._buffer, session=self._session)
            self._buffer = []


@asynccontextmanager
async def buffered_bulk_writer(
    collection, batch_size=100, session: AsyncIOMotorClientSession | None = None
):
    """
    A context manager for bulk writing to MongoDB.

    Returns a :class:``BufferedBulkWriter`` object. Automatically flushes the buffer
    when the context manager exits.

    :param collection: the MongoDB collection to write against
    :param batch_size: the number of requests to be sent in each bulk operation
    :param session: a Motor session to use

    """
    writer = BufferedBulkWriter(collection, batch_size, session=session)

    try:
        yield writer
    finally:
        await writer.flush()
