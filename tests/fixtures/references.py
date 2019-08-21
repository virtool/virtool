import aiohttp.web
import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.fixture(params=[True, False])
def check_ref_right(mocker, request):
    mock = mocker.patch("virtool.references.db.check_right", make_mocked_coro(request.param))

    mock.__bool__ = lambda x: request.param

    mock.called_with_req = lambda: isinstance(mock.call_args[0][0], aiohttp.web.Request)

    return mock
