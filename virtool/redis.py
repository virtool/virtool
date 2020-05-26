import asyncio
import logging
import json
import sys

import aioredis

logger = logging.getLogger(__name__)


async def connect(redis_connection_strong: str) -> aioredis.Redis:
    try:
        redis = await aioredis.create_redis_pool(redis_connection_strong)
        await check_version(redis)

        return redis
    except ConnectionRefusedError:
        logger.fatal("Could not connect to Redis: Connection refused")
        sys.exit(1)


async def check_version(redis):
    info = await redis.execute("INFO", encoding="utf-8")

    for line in info.split("\n"):
        if line.startswith("redis_version"):
            version = line.replace("redis_version:", "")
            logger.info(f"Found Redis {version}")
            return


def create_dispatch(redis):
    async def func(interface, operation, id_list):
        json_string = json.dumps({
            "interface": interface,
            "operation": operation,
            "id_list": id_list
        })

        await redis.publish("channel:dispatch", json_string)

        logger.debug(f"Dispatched message via Redis: {interface}.{operation}")

    return func


async def listen_for_changes(app):
    logging.debug("Started listening for changes")

    dispatch_channel, = await app["redis"].subscribe("channel:dispatch")

    try:
        while True:
            message = await dispatch_channel.get_json()

            if message is not None:
                interface = message["interface"]
                operation = message["operation"]

                await app["change_queue"].put([
                    interface,
                    operation,
                    message["id_list"]
                ])

                logger.debug(f"Received change: {interface}.{operation}")
    except asyncio.CancelledError:
        pass

    logging.debug("Stopped listening for changes")
