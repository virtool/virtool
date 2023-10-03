import datetime
from typing import Any

import pytest
from syrupy.matchers import path_type


def parse_time(data):
    if not isinstance(data, datetime.datetime):
        raise ValueError("timestamp in wrong format")

    if datetime.datetime.utcnow() - data < datetime.timedelta(seconds=30):
        return "approximately_now"
    else:
        return "not_approximately_now"


@pytest.fixture
def snapshot_recent(snapshot):
    return snapshot.with_defaults(
        matcher=path_type(
            mapping={
                "created_at": (datetime.datetime, Any),
                "uploaded_at": (datetime.datetime, Any),
            },
            replacer=lambda data, _: parse_time(data),
        )
    )
