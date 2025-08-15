"""Tests for redirect middleware."""

import pytest
from aiohttp.web_exceptions import HTTPPermanentRedirect

from virtool.api.redirects import redirect_middleware


class MockRequest:
    """Mock request object for testing."""

    def __init__(
        self, path: str, query_string: str = "", headers: dict[str, str] | None = None
    ) -> None:
        self.path = path
        self.query_string = query_string
        self.headers = headers or {}


class TestRedirectMiddleware:
    """Test redirect middleware functionality."""

    async def test_refs_redirect(self) -> None:
        """Test /refs redirects to /references/v1."""
        request = MockRequest("/refs")

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/references/v1"

    async def test_refs_with_path_redirect(self) -> None:
        """Test /refs/foo redirects to /references/v1/foo."""
        request = MockRequest("/refs/foo")

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/references/v1/foo"

    async def test_references_redirect(self) -> None:
        """Test /references redirects to /references/v1."""
        request = MockRequest("/references")

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/references/v1"

    async def test_references_with_path_redirect(self) -> None:
        """Test /references/foo redirects to /references/v1/foo."""
        request = MockRequest("/references/foo")

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/references/v1/foo"

    async def test_references_v1_no_redirect(self) -> None:
        """Test /references/v1 does not redirect."""
        request = MockRequest("/references/v1")
        handler_called = False

        async def handler(r: MockRequest) -> str:
            nonlocal handler_called
            handler_called = True
            return "success"

        result = await redirect_middleware(request, handler)
        assert handler_called
        assert result == "success"

    async def test_query_parameters_preserved(self) -> None:
        """Test query parameters are preserved in redirects."""
        request = MockRequest("/refs", "param=value&other=test")

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/references/v1?param=value&other=test"

    async def test_other_paths_no_redirect(self) -> None:
        """Test other paths are not redirected."""
        request = MockRequest("/api/status")
        handler_called = False

        async def handler(r: MockRequest) -> str:
            nonlocal handler_called
            handler_called = True
            return "success"

        result = await redirect_middleware(request, handler)
        assert handler_called
        assert result == "success"

    @pytest.mark.parametrize(
        "path",
        [
            "/refs/foo/bar",
            "/refs/123/updates",
            "/references/foo/otus",
            "/references/bar/users/123",
        ],
    )
    async def test_nested_paths_redirect(self, path: str) -> None:
        """Test nested paths redirect correctly."""
        request = MockRequest(path)

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        if path.startswith("/refs"):
            expected = path.replace("/refs", "/references/v1", 1)
        else:
            expected = path.replace("/references", "/references/v1", 1)

        assert exc_info.value.location == expected

    async def test_api_prefix_refs_redirect(self) -> None:
        """Test /refs with /api prefix redirects to /api/references/v1."""
        request = MockRequest("/refs", headers={"X-Forwarded-Prefix": "/api"})

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/api//references/v1"

    async def test_api_prefix_references_redirect(self) -> None:
        """Test /references with /api prefix redirects to /api/references/v1."""
        request = MockRequest("/references", headers={"X-Forwarded-Prefix": "/api"})

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/api//references/v1"

    async def test_api_prefix_with_path_redirect(self) -> None:
        """Test /refs/foo with /api prefix redirects to /api/references/v1/foo."""
        request = MockRequest("/refs/foo", headers={"X-Forwarded-Prefix": "/api"})

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/api//references/v1/foo"

    async def test_api_prefix_with_query_params(self) -> None:
        """Test /refs with /api prefix and query params."""
        request = MockRequest(
            "/refs", query_string="param=value", headers={"X-Forwarded-Prefix": "/api"}
        )

        with pytest.raises(HTTPPermanentRedirect) as exc_info:
            await redirect_middleware(request, lambda _: None)

        assert exc_info.value.location == "/api//references/v1?param=value"
