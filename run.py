import asyncio
import logging
import sys

import uvloop

import virtool.app
import virtool.logs

logger = logging.getLogger("aiohttp.server")

sys.dont_write_bytecode = True

if __name__ == "__main__":
    # Set up event loop using uvloop.
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    loop = asyncio.get_event_loop()

    loop.run_until_complete(virtool.app.run())
