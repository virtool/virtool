import asyncio
import functools
from asyncio import CancelledError
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import AsyncGenerator, Awaitable, Callable

from structlog import get_logger
from virtool_core.models.basemodel import BaseModel
from virtool_core.redis import Redis

from virtool.api.custom_json import dump_string
from virtool.utils import get_model_by_name, timestamp

logger = get_logger("events")


class Operation(str, Enum):
    """The possible operations that can be performed on a resource."""

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
    """A target for emitting events that are used internally by the application.

    Calls to ``emit()`` and functions decorated with ``@emits`` will add an event to
    the queue via this target.

    """

    q = asyncio.Queue(maxsize=1000)

    def emit(self, event: Event):
        for _ in range(3):
            try:
                self.q.put_nowait(event)
                return
            except asyncio.QueueFull:
                asyncio.sleep(5)
        logger.error("Event queue full after multiple retries. Dropping event.")

    async def get(self) -> Event:
        """Get an event from the target."""
        return await self.q.get()

    def clear(self):
        self.q = asyncio.Queue()


_events_target = _InternalEventsTarget()


def dangerously_clear_events():
    """Clear all events from the internal queue.

    This should only be used in tests.

    """
    _events_target.clear()


async def dangerously_get_event() -> Event:
    """Get an event directly from the target.

    This should only be used in tests.

    """
    return await _events_target.get()


def emit(data: BaseModel, domain: str, name: str, operation: Operation):
    """Emit an event."""
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
            ),
        )


def emits(operation: Operation, domain: str | None = None, name: str | None = None):
    """Emits the return value of the decorated method as an event.

    By default, ``domain`` is the name of the ``DataLayerDomain`` object the decorated
    method is bound to. It can be overridden by passing a value to the decorator.

    By default, ``name`` is the name of the decorated method. It can be overridden by
    passing a value to the decorator.

    :param operation: The operation that was performed on the resource.
    :param domain: The domain of the resource.
    :param name: The name of the event.

    """

    def decorator(func: Callable[..., Awaitable[BaseModel]]):
        emitted_name = name or func.__name__

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # This is the DataLayerDomain object the method is bound to.
            obj = args[0]

            return_value = await func(*args, **kwargs)

            emit(return_value, domain or obj.name, emitted_name, operation)

            return return_value

        return wrapper

    return decorator


class EventPublisher:
    """Publishes events emitted in the application.

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
                        },
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


async def listen_for_events(redis: Redis) -> AsyncGenerator[Event, None]:
    """Yield events as they are received."""
    async for received in redis.subscribe("channel:events"):
        payload = received.pop("payload")
        cls = get_model_by_name(payload["model"])

        yield Event(**received, data=cls(**payload["data"]))
