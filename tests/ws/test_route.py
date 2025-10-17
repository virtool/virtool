import pytest
from aiohttp.test_utils import make_mocked_coro
from aiohttp.web import Response
from aiohttp.web_ws import WebSocketResponse

from virtool.ws.route import root


@pytest.fixture
def mock_request(mocker):
    """Create a mock request with a client."""
    req = mocker.MagicMock()
    client = mocker.Mock()
    client.authenticated = True
    client.user_id = "test_user"
    req.__getitem__.side_effect = lambda key: client if key == "client" else None
    req.get.side_effect = lambda key, default=None: (
        client if key == "client" else default
    )
    req.app = {"ws": mocker.Mock()}
    req.app["ws"].add_connection = mocker.Mock()
    req.app["ws"].remove_connection = mocker.Mock()
    return req


@pytest.fixture
def mock_ws_response(mocker):
    """Create a mock WebSocketResponse."""
    ws = mocker.Mock(spec=WebSocketResponse)
    ws.prepare = make_mocked_coro()
    ws.close = make_mocked_coro()
    ws.__aiter__ = mocker.Mock(return_value=iter([]))
    return ws


class TestRoot:
    async def test_websocket_connection_not_ready(self, mock_request, mocker):
        """Test handling when can_prepare returns not ready."""
        mock_ws = mocker.Mock(spec=WebSocketResponse)
        mock_ready = mocker.Mock()
        mock_ready.ok = False
        mock_ws.can_prepare.return_value = mock_ready

        mocker.patch(
            "virtool.ws.route.WebSocketResponse",
            return_value=mock_ws,
        )

        result = await root(mock_request)

        assert isinstance(result, Response)
        assert result.status == 400
        assert result.text == "WebSocket connection not available"

    async def test_websocket_prepare_transport_error(self, mock_request, mocker):
        """Test handling when prepare raises AssertionError due to transport."""
        mock_ws = mocker.Mock(spec=WebSocketResponse)
        mock_ready = mocker.Mock()
        mock_ready.ok = True
        mock_ws.can_prepare.return_value = mock_ready
        mock_ws.prepare.side_effect = AssertionError("assert transport is not None")

        mocker.patch(
            "virtool.ws.route.WebSocketResponse",
            return_value=mock_ws,
        )

        result = await root(mock_request)

        assert isinstance(result, Response)
        assert result.status == 503
        assert result.text == "Connection unavailable"

    async def test_websocket_prepare_other_assertion_error(self, mock_request, mocker):
        """Test that non-transport AssertionErrors are re-raised."""
        mock_ws = mocker.Mock(spec=WebSocketResponse)
        mock_ready = mocker.Mock()
        mock_ready.ok = True
        mock_ws.can_prepare.return_value = mock_ready
        mock_ws.prepare.side_effect = AssertionError("some other assertion")

        mocker.patch(
            "virtool.ws.route.WebSocketResponse",
            return_value=mock_ws,
        )

        with pytest.raises(AssertionError, match="some other assertion"):
            await root(mock_request)
