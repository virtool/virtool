import datetime
from types import NoneType

import arrow
import pytest
from syrupy.matchers import path_type


def validate_time(timestamp: datetime.datetime | str | None, _=None) -> str | None:
    """Validates the format and recency of the timestamp

    :param timestamp: a datatime object or an ISO format string representing the time
    :return: a string detailing which format it is in and the recency of it

    :raises ValueError: when timestamp is a string that is not in ISO format
    :raises TypeError: when timestamp is neither datetime object nor string

    """
    if timestamp is None:
        return None

    if isinstance(timestamp, datetime.datetime):
        if arrow.utcnow().naive - timestamp < datetime.timedelta(seconds=30):
            return "approximately_now_datetime"

        return "not_approximately_now_datetime"

    if isinstance(timestamp, str):
        try:
            if arrow.utcnow().naive - arrow.get(timestamp).datetime.replace(
                tzinfo=None,
            ) < datetime.timedelta(
                seconds=30,
            ):
                return "approximately_now_isoformat"

            return "not_approximately_now_isoformat"
        except arrow.parser.ParserError:
            raise ValueError("Timestamp not in isoformat")
    else:
        raise TypeError("Timestamp must be datetime or isoformatted string")


path_recent_time = path_type(
    mapping={
        f".*{key}": (datetime.datetime, str, NoneType)
        for key in [
            "created_at",
            "updated_at",
            "uploaded_at",
            "applied_at",
            "last_password_change",
            "removed_at",
        ]
    },
    regex=True,
    replacer=validate_time,
)


@pytest.fixture()
def snapshot_recent(snapshot):
    return snapshot.with_defaults(
        matcher=path_recent_time,
    )
