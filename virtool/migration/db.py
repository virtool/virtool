import asyncio
from contextlib import asynccontextmanager


@asynccontextmanager
async def persistent_session(mongo: "Mongo"):
    """Create a persistent mongo db session that won't time out due to inactivity.

    :param mongo: the application MongoDB client
    """
    async with (
        await mongo.client.start_session() as session,
    ):

        async def refresh_session():
            while True:
                await asyncio.sleep(600)
                await mongo.command({"refreshSessions": [session.session_id]})

        refresh_task = asyncio.Task(refresh_session())

        yield session

        refresh_task.cancel()
