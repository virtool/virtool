"""Tests for Sentry configuration and context functions."""

from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from virtool.sentry import (
    DEFAULT_TRACES_SAMPLE_RATE,
    UNTRACED_PATHS,
    configure_sentry,
    traces_sampler,
)


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
        assert init_args["traces_sampler"] is traces_sampler
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
    """Test the traces_sampler trace-suppression logic."""

    def test_untraced_path_is_suppressed(self) -> None:
        """A high-frequency probe or polling path is never traced."""
        request = MagicMock(path="/health/ready")

        assert traces_sampler({"aiohttp_request": request}) == 0.0

    def test_all_untraced_paths_are_suppressed(self) -> None:
        """Every configured untraced path is suppressed."""
        for path in UNTRACED_PATHS:
            request = MagicMock(path=path)

            assert traces_sampler({"aiohttp_request": request}) == 0.0

    def test_other_path_uses_default_rate(self) -> None:
        """A normal request path is sampled at the default rate."""
        request = MagicMock(path="/samples")

        assert (
            traces_sampler({"aiohttp_request": request}) == DEFAULT_TRACES_SAMPLE_RATE
        )

    def test_missing_request_uses_default_rate(self) -> None:
        """A non-aiohttp transaction falls back to the default rate."""
        assert traces_sampler({}) == DEFAULT_TRACES_SAMPLE_RATE

    def test_parent_sampling_decision_is_honoured(self) -> None:
        """An upstream sampling decision is inherited for traced paths."""
        request = MagicMock(path="/samples")

        assert (
            traces_sampler({"aiohttp_request": request, "parent_sampled": False}) == 0.0
        )
        assert (
            traces_sampler({"aiohttp_request": request, "parent_sampled": True}) == 1.0
        )

    def test_untraced_path_overrides_parent_sampling(self) -> None:
        """An untraced path is suppressed even when the parent was sampled."""
        request = MagicMock(path="/health/live")

        assert (
            traces_sampler({"aiohttp_request": request, "parent_sampled": True}) == 0.0
        )
