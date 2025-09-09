"""Tests for Sentry configuration and context functions."""

from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from virtool.sentry import _traces_sampler, configure_sentry


class TestConfigureSentry:
    """Test the configure_sentry function."""

    def test_configure_sentry_with_dsn(self, mocker: MockerFixture) -> None:
        """Test that Sentry is initialized when DSN is provided."""
        mock_sentry_sdk = mocker.patch("virtool.sentry.sentry_sdk")

        dsn = "https://test@sentry.io/123"
        release = "9.1.0"

        configure_sentry(dsn, release)

        mock_sentry_sdk.init.assert_called_once()
        init_args = mock_sentry_sdk.init.call_args[1]

        assert init_args["dsn"] == dsn
        assert init_args["release"] == release
        assert "traces_sampler" in init_args
        assert "_experiments" in init_args
        assert init_args["_experiments"]["enable_logs"] is True

    def test_configure_sentry_without_dsn(self, mocker: MockerFixture) -> None:
        """Test that Sentry is not initialized when DSN is not provided."""
        mock_sentry_sdk: MagicMock = mocker.patch("virtool.sentry.sentry_sdk")

        configure_sentry("", "9.1.0")

        mock_sentry_sdk.init.assert_not_called()

    def test_configure_sentry_with_none_dsn(self, mocker: MockerFixture) -> None:
        """Test that Sentry is not initialized when DSN is None."""
        mock_sentry_sdk: MagicMock = mocker.patch("virtool.sentry.sentry_sdk")

        configure_sentry(None, "9.1.0")
        mock_sentry_sdk.init.assert_not_called()


class TestTracesSampler:
    """Test the _traces_sampler function."""

    def test_traces_sampler_websocket_route(self) -> None:
        """Test that WebSocket routes return 0.0 sampling rate."""
        context = {"aiohttp_request": MagicMock(rel_url="/ws")}

        result = _traces_sampler(context)

        assert result == 0.0

    def test_traces_sampler_normal_route(self) -> None:
        """Test that normal routes return 0.6 sampling rate."""
        context = {"aiohttp_request": MagicMock(rel_url="/api/samples")}

        result = _traces_sampler(context)

        assert result == 0.6

    def test_traces_sampler_missing_request(self, mocker: MockerFixture) -> None:
        """Test that missing aiohttp_request returns 0.6 sampling rate."""
        mock_logger = mocker.patch("virtool.sentry.logger")
        context = {}

        result = _traces_sampler(context)

        assert result == 0.6
        mock_logger.warning.assert_called_once_with(
            "could not determine sentry transaction name"
        )
