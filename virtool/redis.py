"""Redis client class, types, and errors."""

from collections.abc import AsyncGenerator
from types import TracebackType
from typing import Any

import orjson
import redis
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from structlog import get_logger

logger = get_logger("redis")

type RedisElement = float | int | str | dict
"""A type alias for the types that can be stored in Redis.
"""


class RedisError(Exception):
    """A generic error raised when interacting with Redis."""


class RedisAuthenticationError(RedisError):
    """Raised when Redis authentication fails."""

    def __init__(self) -> None:
        """Initialize a RedisAuthenticationError with the given message."""
        super().__init__("Could not authenticate: invalid username or password")


class RedisBlpopTimeoutError(RedisError):
    """Raised when Redis BLPOP operation times out."""

    def __init__(self, key: str) -> None:
        """Initialize a RedisAuthenticationError with the given message."""
        super().__init__(f"Redis BLPOP timed out for key {key}")
        self.key = key


class RedisConnectionError(RedisError):
    """Raised when unable to connect to Redis server."""

    def __init__(self) -> None:
        """Initialize a RedisConnectionError with the given message."""
        super().__init__("Could not connect")


class RedisServerInfoError(RedisError):
    """An error raised when a Redis server info is unavailable."""

    def __init__(self) -> None:
        """Initialize a RedisServerInfoError."""
        super().__init__(
            "Could not get server version because server info is not available."
        )


class RedisValueError(RedisError):
    """Raised when an invalid value type is passed to Redis operations."""

    def __init__(self, value: object) -> None:
        """Initialize a RedisValueError with the invalid value."""
        super().__init__(f"Unsupported Redis value type: {type(value).__name__}")
        self.value = value


def _coerce_redis_request(value: RedisElement) -> bytes | int | float:
    if isinstance(value, (int, float)):
        return value

    if isinstance(value, dict):
        return orjson.dumps(value)

    if isinstance(value, str):
        return value.encode("utf-8")

    raise RedisValueError(value)


def _coerce_redis_response(value: bytes | str | int) -> RedisElement:
    if isinstance(value, (float, int, str)):
        return value

    try:
        return orjson.loads(value)
    except orjson.JSONDecodeError:
        return value.decode("utf-8")


class Redis:
    """A Redis client based on ``redis``.

    Example:
    -------
    .. code-block:: python

        async with Redis("redis://localhost:6379") as redis:
            await redis.set("virtool", "The best virus detection platform")

            value = await redis.get("virtool"))
            # The best virus detection platform

    Features:

    * After successful connection, the client automatically pings the server to keep the
      connection alive.
    * The connection is automatically closed when the context manager exits.
    * Dictionaries, strings, integers, and floats are automatically serialized and
      deserialized.

    :param connection_string: the connection string for the Redis server

    """

    def __init__(self, connection_string: str) -> None:
        """Initialize a Redis client from a connection string."""
        self._client = redis.asyncio.from_url(
            connection_string,
            health_check_interval=120,
            retry=Retry(ExponentialBackoff(cap=10, base=1), 25),
            retry_on_error=[redis.ConnectionError, redis.TimeoutError],
        )
        """The underlying Redis client object."""

        self._client_info: dict[str, Any] | None = None
        """The Redis server information, first fetched when the connection is opened."""

    async def __aenter__(self) -> "Redis":
        """Connect to a Redis server and return this wrapper."""
        await self.connect()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Close the connection."""
        await self.close()

    @property
    def database_id(self) -> int:
        """The ID of the Redis database that this client is connected to."""
        return self._client.connection_pool.connection_kwargs.get("db", 0)

    @property
    def server_version(self) -> str:
        """The version of the connected Redis server."""
        if self._client_info is None:
            raise RedisServerInfoError

        return str(self._client_info["redis_version"])

    async def connect(self) -> None:
        """Connect to the Redis server and retrieve the server info."""
        logger.info("connecting to redis")

        try:
            self._client_info = await self._client.info()
        except redis.AuthenticationError as e:
            raise RedisAuthenticationError from e
        except redis.ConnectionError as e:
            raise RedisConnectionError from e

    async def close(self) -> None:
        """Close the connection to the Redis server."""
        if self._client:
            logger.info("disconnecting from redis")
            await self._client.aclose()

    async def get(self, key: str) -> RedisElement | None:
        """Get the value at ``key``.

        :param key: the key to get
        :return: the value at ``key``
        """
        value = await self._client.get(key)

        if value is None:
            return None

        return _coerce_redis_response(value)

    async def set(self, key: str, value: RedisElement, expire: int = 0) -> None:
        """Set the value at ``key`` to value.

        An optional expiry time can be provided.

        :param key: the key to set
        :param value: the value to set
        :param expire: the expiration time in seconds

        """
        if expire == 0:
            await self._client.set(key, _coerce_redis_request(value))
        else:
            await self._client.setex(key, expire, _coerce_redis_request(value))

    async def delete(self, key: str) -> None:
        """Delete the value at ``key``."""
        await self._client.delete(key)

    async def ttl(self, key: str) -> int:
        """Get the time-to-live for a ``key`` in seconds."""
        return await self._client.ttl(key)

    async def subscribe(
        self,
        channel_name: str,
    ) -> AsyncGenerator[RedisElement]:
        """Subscribe to a channel with ``channel_name`` and yield messages.

        Example:
        -------
        .. code-block:: python

                async for message in redis.subscribe("channel:cancel"):
                    ...

        :param channel_name: the name of the channel to subscribe to
        :return: an async generator that yields messages

        """
        async with self._client.pubsub() as pubsub:
            await pubsub.subscribe(channel_name)

            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield _coerce_redis_response(message["data"])

    async def publish(self, channel_name: str, message: RedisElement) -> None:
        """Publish a message to a channel.

        :param channel_name: the name of the channel to publish to
        :param message: the message to publish

        """
        await self._client.publish(channel_name, _coerce_redis_request(message))

    async def blpop(self, key: str) -> RedisElement:
        """Remove and return the first element of the list at ``key``.

        This method will block until a value is available.

        :param key: the key to get
        :return: the first element of the list

        """
        result = await self._client.blpop([key])
        if result is None:
            raise RedisBlpopTimeoutError(key)

        _, value = result
        return _coerce_redis_response(value)

    async def llen(self, key: str) -> int:
        """Get the length of the list at ``key``.

        :param key: the key of the list to get the length of
        :return: the length of the list
        """
        return await self._client.llen(key)

    async def lrange(self, key: str, start: int, end: int) -> list[RedisElement]:
        """Get a range of elements from the list at ``key``.

        :param key: the key of the list to get from
        :param start: the start index
        :param end: the end index
        :return: a list of elements

        """
        return [
            _coerce_redis_response(value)
            for value in await self._client.lrange(key, start, end)
        ]

    async def lpop(self, key: str) -> RedisElement | None:
        """Remove and return the first element of the list at ``key``."""
        value = await self._client.lpop(key)

        if value is None:
            return None

        return _coerce_redis_response(value)

    async def lrem(self, key: str, count: int, element: str) -> int:
        """Remove the first ``count`` elements from the list at ``key``.

        The ``count`` argument influences the following behaviours:

        * count > 0: Remove head to tail.
        * count < 0: Remove tail to head.
        * count = 0: Remove everywhere.

        :param key: the key of the list to remove from
        :param count: the number of elements to remove
        :param element: the element to remove

        """
        return await self._client.lrem(key, count, element)

    async def rpush(self, key: str, *values: RedisElement) -> int:
        """Push ``values`` onto the tail of the list ``key``.

        :param key: the key of the list to push to
        :param values: the values to push
        :return: the length of the list after pushing
        """
        return await self._client.rpush(
            key,
            *[_coerce_redis_request(v) for v in values],
        )

    async def flushdb(self) -> None:
        """Delete all keys in the current database."""
        await self._client.flushdb(asynchronous=False)
