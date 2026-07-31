import asyncio


class Events:
    def __init__(self):
        self.cancelled = asyncio.Event()
        self.completed = asyncio.Event()
        """The workflow has finished its steps and the job may now be terminal.

        Pings are rejected once the job is terminal. That rejection means the job is
        over rather than cancelled, so it must not interrupt the remaining hooks.
        """

        self.terminated = asyncio.Event()
