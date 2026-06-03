"""Tests for Sentry configuration and context functions."""

from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from virtool.sentry import configure_sentry


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
        assert init_args["traces_sample_rate"] == 0.6
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
