import asyncio


class Events:
    def __init__(self):
        self.cancelled = asyncio.Event()
        self.terminated = asyncio.Event()
