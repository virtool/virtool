import datetime
from typing import Any

import pytest
import arrow
from syrupy.matchers import path_type


def validate_time(timestamp: datetime.datetime | str | Any, _=None):
    """
    Validates the format and recency of the timestamp

    :param timestamp: a datatime object or an isoformatted string representing the time

    :return: a string detailing which format it is in and the recency of it

    :Raises:
        ValueError - when timestamp is a string that is not isoformatted
        TypeError - when timestamp is neither datetime object nor string


    """
    if isinstance(timestamp, datetime.datetime):
        if datetime.datetime.now(datetime.timezone.utc) - timestamp < datetime.timedelta(seconds=30):
            return "approximately_now_datetime"
        return "not_approximately_now_datetime"
    if isinstance(timestamp, str):
        try:
            timestamp_datetime = arrow.get(timestamp).datetime.replace(tzinfo=datetime.timezone.utc)
            if datetime.datetime.now(datetime.timezone.utc) - timestamp_datetime < datetime.timedelta(
                seconds=30
            ):
                return "approximately_now_isoformat"
            return "not_approximately_now_isoformat"
        except arrow.parser.ParserError:
            raise ValueError("Timestamp not in isoformat")
    else:
        raise TypeError("Timestamp must be datetime or isoformatted string")


@pytest.fixture
def snapshot_recent(snapshot):
    return snapshot.with_defaults(
        matcher=path_type(
            mapping={
                ".*applied_at": (datetime.datetime, str, Any),
                ".*created_at": (datetime.datetime, str, Any),
                ".*last_password_change": (datetime.datetime, str, Any),
                ".*updated_at": (datetime.datetime, str, Any),
                ".*uploaded_at": (datetime.datetime, str, Any),
                ".*removed_at": (datetime.datetime, str, Any),
            },
            regex=True,
            replacer=validate_time,
        )
    )
