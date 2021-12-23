import aiohttp.web
import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.fixture(params=[True, False])
def check_ref_right(mocker, request):
    mock = mocker.patch(
        "virtool.references.db.check_right", make_mocked_coro(request.param)
    )

    mock.__bool__ = lambda x: request.param

    mock.called_with_req = lambda: isinstance(mock.call_args[0][0], aiohttp.web.Request)

    return mock


@pytest.fixture
def reference(static_time):
    return {
        "_id": "3tt0w336",
        "created_at": static_time,
        "data_type": "genome",
        "description": "",
        "name": "Original",
        "organism": "virus",
        "internal_control": None,
        "restrict_source_types": False,
        "source_types": ["isolate", "strain"],
        "groups": [],
        "users": [
            {
                "id": "igboyes",
                "build": True,
                "modify": True,
                "modify_otu": True,
                "remove": True,
            }
        ],
        "user": {"id": "igboyes"},
        "imported_from": {
            "name": "reference.json.gz",
            "user": {"id": "igboyes"},
            "id": "knoqfdk9-reference.json.gz",
        },
        "task": {"id": "flv0gecl"},
    }
