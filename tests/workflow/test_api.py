import time

import pytest
from aiohttp import (
    ClientConnectionError,
    ClientError,
    ServerTimeoutError,
)
from pytest_structlog import StructuredLogCapture

from virtool.workflow.api.utils import retry


async def test_retry_without_parameters(log: StructuredLogCapture):
    """Test that the retry decorator works without parameters (legacy behavior)."""

    class Retry:
        def __init__(self):
            self.attempt = 0
            self.args = []
            self.kwargs = {}

        @retry
        async def do_something(self, *args, **kwargs):
            self.attempt += 1

            if self.attempt == 1:
                raise ConnectionRefusedError

            self.args = args
            self.kwargs = kwargs

    obj = Retry()

    await obj.do_something("hello", this_is_a_test=True)

    assert obj.attempt == 2
    assert obj.args == ("hello",)
    assert obj.kwargs == {"this_is_a_test": True}
    assert log.has("retrying after connection error")


class TestRetryWithParameters:
    """Test the retry decorator with parameters."""

    async def test_success_after_failure(self):
        """Test that decorator succeeds after connection errors."""
        call_count = 0

        @retry(max_retries=2, base_delay=0.01)
        async def failing_function():
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                raise ConnectionResetError("Connection failed")
            return "success"

        result = await failing_function()

        assert result == "success"
        assert call_count == 2

    async def test_max_retries_exceeded(self):
        """Test that decorator raises exception after max retries."""
        call_count = 0

        @retry(max_retries=2, base_delay=0.01)
        async def always_failing_function():
            nonlocal call_count
            call_count += 1
            raise ClientError("Always fails")

        with pytest.raises(ClientError, match="Always fails"):
            await always_failing_function()

        assert call_count == 3  # Initial attempt + 2 retries

    async def test_exponential_backoff(self):
        """Test that decorator uses exponential backoff when base_delay != 5.0."""
        call_times = []

        @retry(max_retries=2, base_delay=0.1)
        async def timing_function():
            call_times.append(time.time())
            raise ConnectionResetError("Connection reset")

        with pytest.raises(ConnectionResetError):
            await timing_function()

        # Should have 3 calls: initial + 2 retries
        assert len(call_times) == 3

        # Check exponential backoff timing (allowing some tolerance)
        first_delay = call_times[1] - call_times[0]
        second_delay = call_times[2] - call_times[1]

        assert 0.08 <= first_delay <= 0.15  # ~0.1s base delay
        assert 0.18 <= second_delay <= 0.25  # ~0.2s (base * 2)

    async def test_fixed_delay_for_legacy_behavior(self):
        """Test that decorator uses fixed delay when base_delay = 5.0 (legacy behavior)."""
        call_times = []

        @retry(max_retries=1, base_delay=5.0)  # Reduced retries for faster test
        async def timing_function():
            call_times.append(time.time())
            raise ConnectionResetError("Connection reset")

        with pytest.raises(ConnectionResetError):
            await timing_function()

        # Should have 2 calls: initial + 1 retry
        assert len(call_times) == 2

        # Check fixed delay timing (allowing some tolerance for test execution)
        first_delay = call_times[1] - call_times[0]

        # Delay should be close to 5.0 seconds (fixed delay)
        assert 4.8 <= first_delay <= 5.2

    @pytest.mark.parametrize(
        "exception_type",
        [
            ClientError,
            ClientConnectionError,
            ConnectionError,
            ConnectionResetError,
            ServerTimeoutError,
        ],
    )
    async def test_handles_various_exceptions(self, exception_type: type[Exception]):
        """Test that decorator handles various connection-related exceptions."""
        call_count = 0

        @retry(max_retries=1, base_delay=0.01)
        async def function_with_exception():
            nonlocal call_count
            call_count += 1

            if call_count == 1:
                raise exception_type("Test exception")
            return "recovered"

        result = await function_with_exception()

        assert result == "recovered"
        assert call_count == 2

    async def test_preserves_other_exceptions(self):
        """Test that decorator doesn't retry non-connection exceptions."""
        call_count = 0

        @retry(max_retries=2, base_delay=0.01)
        async def function_with_value_error():
            nonlocal call_count
            call_count += 1
            raise ValueError("Not a connection error")

        with pytest.raises(ValueError, match="Not a connection error"):
            await function_with_value_error()

        # Should only be called once (no retries for non-connection errors)
        assert call_count == 1
