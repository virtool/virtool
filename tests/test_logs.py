"""Tests for logging configuration."""

import io
import logging
import re
from unittest.mock import MagicMock

import pytest
import structlog
from pytest_mock import MockerFixture

from virtool.logs import configure_logging, normalize_log_level


@pytest.fixture(autouse=True)
def reset_logging():
    """Reset structlog and logging configuration before each test."""
    # Store original state
    original_handlers = logging.getLogger().handlers.copy()

    # Reset structlog configuration
    structlog.reset_defaults()

    # Clear existing logging handlers
    logging.getLogger().handlers.clear()

    yield

    # Restore original state
    structlog.reset_defaults()
    logging.getLogger().handlers.clear()
    logging.getLogger().handlers.extend(original_handlers)


def capture_log_output() -> tuple[io.StringIO, logging.Handler]:
    """Capture log output for testing."""
    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)
    return buffer, handler


class TestLogConfiguration:
    """Tests for configure_logging function."""

    def test_ok(self):
        """Base success case for log configuration."""
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")
        logger.info("test message")

    def test_handles_exception_level_without_error(self):
        """Verify exception level is handled without raising ValueError."""
        buffer, _ = capture_log_output()
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")

        # Test that calling logger.exception() doesn't raise an error
        try:
            msg = "Test error"
            raise ValueError(msg)
        except Exception:
            logger.exception("Test exception message")

        # Verify the message was logged and level was mapped to error
        output = buffer.getvalue().strip()
        assert "Test exception message" in output
        assert "level=error" in output

    def test_logger_reconfiguration_works(self):
        """Verify existing loggers work properly after configure_logging is called."""
        buffer, _ = capture_log_output()

        # Create logger before configure_logging (simulating the original issue)
        structlog.get_logger("runtime")

        # Configure logs
        configure_logging(use_sentry=False)

        # Recreate logger after configure_logging (simulating the fix)
        logger_after = structlog.get_logger("runtime")

        # Test that exception logging works without raising ValueError
        try:
            msg = "Test error"
            raise ValueError(msg)
        except Exception:
            logger_after.exception("Test exception logging")

        # Verify the exception was logged correctly
        output = buffer.getvalue().strip()
        assert "Test exception logging" in output
        assert "level=error" in output

    def test_sentry_processor_configuration(self, mocker: MockerFixture):
        """Verify SentryProcessor is configured correctly when use_sentry=True."""
        mock_sentry_processor_class = mocker.patch(
            "virtool.logs.SentryProcessor",
        )
        mock_processor_instance = MagicMock()
        mock_sentry_processor_class.return_value = mock_processor_instance

        configure_logging(use_sentry=True)

        # Verify SentryProcessor was instantiated with correct parameters
        mock_sentry_processor_class.assert_called_once_with(
            event_level=logging.WARNING,
            level=logging.INFO,
        )

    def test_sentry_processor_receives_events(self, mocker: MockerFixture):
        """Verify SentryProcessor receives and processes log events correctly."""
        mock_sentry_processor_class = mocker.patch(
            "virtool.logs.SentryProcessor",
        )
        mock_processor_instance = MagicMock()
        # Make the processor return the event_dict unchanged
        mock_processor_instance.side_effect = (
            lambda _logger, _method, event_dict: event_dict
        )
        mock_sentry_processor_class.return_value = mock_processor_instance

        configure_logging(use_sentry=True)
        logger = structlog.get_logger("test_logger")

        # Test regular error logging
        logger.error("test error message", key="value")

        # Verify the processor was called
        assert mock_processor_instance.call_count > 0
        method_names = [call[0][1] for call in mock_processor_instance.call_args_list]
        assert "error" in method_names

        # Test exception logging
        mock_processor_instance.reset_mock()

        try:
            msg = "test exception"
            raise ValueError(msg)
        except Exception:
            logger.exception("exception occurred", extra_data="test")

        # Verify SentryProcessor was called for the exception
        assert mock_processor_instance.call_count > 0
        method_names = [call[0][1] for call in mock_processor_instance.call_args_list]
        assert "exception" in method_names


class TestLogFormatting:
    """Tests for log output formatting."""

    def test_logfmt_basic_structure(self):
        """Verify basic logfmt output structure and content."""
        buffer, _ = capture_log_output()
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")

        # Test basic log message with structured data
        logger.info("test message", key="value", number=42, bool_flag=True)

        output = buffer.getvalue().strip()

        # Verify basic components are present
        assert "test message" in output
        assert "test_logger" in output
        assert "level=info" in output
        assert "key=value" in output
        assert "number=42" in output
        assert "bool_flag" in output

    def test_timestamp_format(self):
        """Verify ISO 8601 timestamp format in output."""
        buffer, _ = capture_log_output()
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")

        logger.info("test message")
        output = buffer.getvalue().strip()

        # Verify timestamp format (ISO 8601)
        timestamp_pattern = r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"
        assert re.search(timestamp_pattern, output), (
            f"No valid timestamp found in: {output}"
        )

    def test_exception_level_maps_to_error(self):
        """Verify exception logging maps to error level in output."""
        buffer, _ = capture_log_output()
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")

        try:
            msg = "test exception"
            raise ValueError(msg)
        except Exception:
            logger.exception("exception occurred")

        output = buffer.getvalue().strip()
        assert "exception occurred" in output
        assert "level=error" in output  # exception should map to error level

    def test_structured_data_formatting(self):
        """Verify structured data is properly formatted in logfmt."""
        buffer, _ = capture_log_output()
        configure_logging(use_sentry=False)
        logger = structlog.get_logger("test_logger")

        logger.warning("alert", user_id=123, action="login", success=True)

        output = buffer.getvalue().strip()
        assert "level=warning" in output
        assert "user_id=123" in output
        assert "action=login" in output
        assert "success" in output


class TestNormalizeLogLevel:
    """Tests for normalize_log_level function."""

    @pytest.mark.parametrize(
        ("input_level", "expected_level"),
        [
            ("exception", "error"),
            ("info", "info"),
            ("warning", "warning"),
            ("error", "error"),
            ("debug", "debug"),
            ("critical", "critical"),
        ],
    )
    def test_level_mapping(self, input_level: str, expected_level: str):
        """Verify normalize_log_level maps levels correctly."""
        input_dict = {
            "event": "test message",
            "level": input_level,
            "timestamp": "2023-01-01T00:00:00Z",
            "logger": "test_logger",
            "extra_field": "extra_value",
        }
        result = normalize_log_level(None, "unused_method_name", input_dict)

        # Check level is correctly mapped
        assert result["level"] == expected_level

    def test_preserves_other_fields(self):
        """Verify other fields remain unchanged."""
        input_dict = {
            "event": "test message",
            "level": "exception",
            "timestamp": "2023-01-01T00:00:00Z",
            "logger": "test_logger",
            "extra_field": "extra_value",
        }
        result = normalize_log_level(None, "unused_method_name", input_dict)

        # Check other fields are unchanged
        assert result["event"] == "test message"
        assert result["timestamp"] == "2023-01-01T00:00:00Z"
        assert result["logger"] == "test_logger"
        assert result["extra_field"] == "extra_value"

    def test_mutates_in_place(self):
        """Verify dict is mutated in place, not copied."""
        input_dict = {"level": "exception", "event": "test"}
        result = normalize_log_level(None, "unused_method_name", input_dict)

        # Check same object is returned (mutation, not copy)
        assert result is input_dict

    def test_handles_missing_level(self):
        """Verify function handles dict without level field."""
        input_dict = {"event": "test message", "logger": "test_logger"}
        result = normalize_log_level(None, "unused_method_name", input_dict)

        # Should return unchanged dict
        assert result is input_dict
        assert "level" not in result

    def test_handles_none_level(self):
        """Verify function handles None level value."""
        input_dict = {"level": None, "event": "test message"}
        result = normalize_log_level(None, "unused_method_name", input_dict)

        # Should return unchanged dict
        assert result is input_dict
        assert result["level"] is None
