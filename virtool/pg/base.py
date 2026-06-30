from enum import Enum
from typing import Protocol

from sqlalchemy import DateTime, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Mapper

from virtool.utils import ensure_naive_utc


class Base(DeclarativeBase):
    __allow_unmapped__ = True

    def __repr__(self):
        params = ", ".join(
            f"{column}={value}" for column, value in self.to_dict().items()
        )

        return f"<{self.__class__.__name__}({params})>"

    def to_dict(self):
        row = {}

        for column in self.__table__.columns:
            value = getattr(self, column.name, None)

            # Enums cannot serialize to JSON
            row[column.name] = value if not isinstance(value, Enum) else value.value

        return row


def _enforce_naive_utc(mapper: Mapper, _, target: Base) -> None:
    """Reject any aware datetime column before it is persisted.

    Applied to every mapped class via ``before_insert`` and ``before_update`` so the
    naive-UTC invariant is enforced loudly at the PostgreSQL write boundary.
    """
    for attr in mapper.column_attrs:
        column = attr.columns[0]

        if not isinstance(column.type, DateTime):
            continue

        ensure_naive_utc(getattr(target, attr.key, None))


event.listen(Base, "before_insert", _enforce_naive_utc, propagate=True)
event.listen(Base, "before_update", _enforce_naive_utc, propagate=True)


class HasLegacyAndModernIDs(Protocol):
    """A protocol for models that have both legacy and modern ids."""

    legacy_id: Mapped[str | None]
    id: Mapped[int]
