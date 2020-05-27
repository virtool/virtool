import asyncio
import logging
import sys

import uvloop

import virtool.config
import virtool.logs

logger = logging.getLogger("aiohttp.server")

sys.dont_write_bytecode = True

if __name__ == "__main__":
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    virtool.config.entry()
