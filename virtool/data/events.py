import asyncio
import functools
from asyncio import CancelledError
from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import ParamSpec, TypeVar

import asyncpg
import orjson
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

from virtool.api.custom_json import dump_string
from virtool.models.base import BaseModel
from virtool.pg.utils import PgOptions
from virtool.utils import timestamp

logger = get_logger("events")

P = ParamSpec("P")
R = TypeVar("R", bound=BaseModel)


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


@dataclass
class ClientEvent:
    """A notification received from Postgres LISTEN."""

    domain: str
    resource_id: str | int
    operation: str


class _InternalEventsTarget:
    """A target for emitting events that are used internally by the application.

    Calls to ``emit()`` and functions decorated with ``@emits`` will add an event to
    the queue via this target.

    """

    def __init__(self):
        self.q = asyncio.Queue(maxsize=1000)

    def emit(self, event: Event):
        for _ in range(3):
            try:
                self.q.put_nowait(event)
                return
            except asyncio.QueueFull:
                asyncio.sleep(5)

        logger.error("event queue full after multiple retries. dropping event.")

    async def get(self) -> Event:
        """Get an event from the target."""
        return await self.q.get()

    def clear(self):
        self.q = asyncio.Queue()


_events_target = _InternalEventsTarget()


def dangerously_clear_events() -> None:
    """Clear all events from the internal queue.

    This should only be used in workflow.

    """
    _events_target.clear()


async def dangerously_get_event() -> Event:
    """Get an event directly from the target.

    This should only be used in workflow.
    """
    return await _events_target.get()


def emit(data: BaseModel, domain: str, name: str, operation: Operation) -> None:
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
    """Emit the return value of the decorated method as an event.

    By default, ``domain`` is the name of the ``DataLayerDomain`` object the decorated
    method is bound to. It can be overridden by passing a value to the decorator.

    By default, ``name`` is the name of the decorated method. It can be overridden by
    passing a value to the decorator.

    :param operation: The operation that was performed on the resource.
    :param domain: The domain of the resource.
    :param name: The name of the event.

    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        emitted_name = name or func.__name__

        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # This is the DataLayerDomain object the method is bound to.
            obj = args[0]

            return_value = await func(*args, **kwargs)

            emit(return_value, domain or obj.name, emitted_name, operation)

            return return_value

        return wrapper

    return decorator


class EventPublisher:
    """Publishes events emitted in the application.

    Events are published using Postgres NOTIFY.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def run(self) -> None:
        """Start the event publisher."""
        logger.info("starting event publisher")

        try:
            while True:
                event = await _events_target.get()

                try:
                    payload = dump_string(
                        {
                            "domain": event.domain,
                            "resource_id": event.data.id,
                            "operation": event.operation.value,
                        }
                    )

                    async with AsyncSession(self._pg) as session:
                        await session.execute(
                            text("SELECT pg_notify(:channel, :payload)"),
                            {"channel": "client_events", "payload": payload},
                        )
                        await session.commit()

                    logger.info(
                        "published event",
                        domain=event.domain,
                        resource_id=event.data.id,
                        operation=event.operation,
                    )
                except Exception:
                    logger.exception(
                        "failed to publish event",
                        domain=event.domain,
                        name=event.name,
                        operation=event.operation,
                    )
        except CancelledError:
            pass


async def listen_for_client_events(
    pg_options: PgOptions,
) -> AsyncGenerator[ClientEvent]:
    """Listen for client events via Postgres NOTIFY.

    Uses a dedicated asyncpg connection outside the SQLAlchemy pool.
    """
    try:
        conn = await asyncpg.connect(
            database=pg_options.database,
            host=pg_options.host,
            user=pg_options.username,
            password=pg_options.password,
            ssl=pg_options.ssl,
        )
        queue: asyncio.Queue[str] = asyncio.Queue()
    except Exception as e:
        logger.warning("failed to connect to database", exc_info=e)

    def on_notify(connection, pid, channel, payload):
        queue.put_nowait(payload)

    await conn.add_listener("client_events", on_notify)
    logger.info("listening for client events")

    try:
        while True:
            payload = await queue.get()
            data = orjson.loads(payload)
            yield ClientEvent(
                domain=data["domain"],
                resource_id=data["resource_id"],
                operation=data["operation"],
            )
    finally:
        await conn.remove_listener("client_events", on_notify)
        await conn.close()
