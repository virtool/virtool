import asyncio
import functools
import json
import sys
from asyncio import CancelledError
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Awaitable, Callable, AsyncIterable
from structlog import get_logger
from virtool_core.models.basemodel import BaseModel
from virtool_core.redis import Redis, resubscribe, ChannelClosedError

from virtool.api.custom_json import dump_string
from virtool.utils import timestamp, get_model_by_name

logger = get_logger("events")


class Operation(str, Enum):
    """
    The possible operations that can be performed on a resource.

    """

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"


@dataclass
class Event:
    data: BaseModel
    domain: str
    name: str
    operation: Operation
    timestamp: datetime


class _InternalEventsTarget:
    """
    A target for emitting events that are used internally by the application.

    Calls to ``emit()`` and functions decorated with ``@emits`` will add an event to
    the queue via this target.

    """

    q = asyncio.Queue(maxsize=1000)

    def emit(self, event: Event):
        self.q.put_nowait(event)

    async def get(self) -> Event:
        """
        Get an event from the target.
        """
        return await self.q.get()

    def clear(self):
        self.q = asyncio.Queue()


_events_target = _InternalEventsTarget()


def dangerously_clear_events():
    """
    Clear all events from the internal queue.

    This should only be used in tests.

    """
    _events_target.clear()


async def dangerously_get_event() -> Event:
    """
    Get an event directly from the target.

    This should only be used in tests.

    """
    return await _events_target.get()


def emit(data: BaseModel, domain: str, name: str, operation: Operation):
    """
    Emit an event.


    """

    if data is None:
        logger.warning("emit event with no data")
    else:
        _events_target.emit(
            Event(
                data=data,
                domain=domain,
                name=name,
                operation=operation,
                timestamp=timestamp(),
            )
        )


def emits(operation: Operation, domain: str | None = None, name: str | None = None):
    """
    Emits the return value of decorated method as an event.

    """

    def decorator(func: Callable[..., Awaitable[BaseModel]]):
        emitted_name = name or func.__name__

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # This is the DataLayerPiece instance the method is bound to.
            obj = args[0]

            return_value = await func(*args, **kwargs)

            emit(return_value, domain or obj.name, emitted_name, operation)

            return return_value

        return wrapper

    return decorator


class EventPublisher:
    """
    Publishes events emitted in the application.

    Events are published using Redis pub/sub.

    """

    def __init__(self, redis: Redis):
        self._redis = redis

    async def run(self):
        """Start the event publisher."""
        logger.info("Starting event publisher")

        try:
            while True:
                event = await _events_target.get()
                try:
                    data = event.data.dict()
                except AttributeError:
                    logger.exception(
                        "Encountered exception while publishing event",
                        domain=event.domain,
                        name=event.name,
                        operation=event.operation,
                    )
                    continue

                await self._redis.publish(
                    "channel:events",
                    dump_string(
                        {
                            "domain": event.domain,
                            "name": event.name,
                            "operation": event.operation,
                            "payload": {
                                "data": data,
                                "model": event.data.__class__.__name__,
                            },
                            "timestamp": event.timestamp,
                        }
                    ),
                )

                logger.info(
                    "Published event",
                    domain=event.domain,
                    name=event.name,
                    operation=event.operation,
                )
        except CancelledError:
            pass


class EventListener(AsyncIterable):
    """Pulls events as they are received and yields them as :class:`.Event` objects."""

    def __init__(self, redis: Redis):
        self._redis = redis
        self._channel: Channel | None = None
        self._channel_name = "channel:events"

    def __aiter__(self):
        return self

    async def __anext__(self) -> Event:
        if not self._channel:
            self._channel = await self._redis.subscribe(self._channel_name)

        while True:
            try:
                received = await self._channel.get_message(True, timeout=1)
                data = json.loads(received["data"].decode())
                payload = data.pop("payload")
                cls = get_model_by_name(payload["model"])
                return Event(**data, data=cls(**payload["data"]))
            except ChannelClosedError:
                try:
                    self._channel = await asyncio.wait_for(
                        resubscribe(self._redis, self._channel_name), 10
                    )
                except asyncio.TimeoutError:
                    logger.critical(
                        "Could not resubscribe to Redis channel",
                        channel=self._channel_name,
                    )
                    sys.exit(1)
            except TypeError:
                pass
