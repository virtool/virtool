import datetime
from typing import Any

import pytest
from syrupy.matchers import path_type


def validate_time(timestamp: datetime.datetime | Any):
    """
    Validates the format and recency of the timestamp
    """
    if not isinstance(timestamp, datetime.datetime):
        raise ValueError("timestamp in wrong format")

    if datetime.datetime.utcnow() - timestamp < datetime.timedelta(seconds=30):
        return "approximately_now"
    else:
        return "not_approximately_now"


@pytest.fixture
def snapshot(snapshot):
    return snapshot.with_defaults(
        matcher=path_type(
            mapping={
                "created_at": (datetime.datetime, Any),
                "uploaded_at": (datetime.datetime, Any),
                "applied_at": (datetime.datetime, Any),
                "updated_at": (datetime.datetime, Any),
            },
            replacer=lambda timestamp, _: validate_time(timestamp),
        )
    )
