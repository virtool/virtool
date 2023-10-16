from enum import Enum
from typing import Protocol

from sqlalchemy.orm import DeclarativeBase, Mapped


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


class HasLegacyAndModernIDs(Protocol):
    """A protocol for models that have both legacy and modern ids."""

    legacy_id: Mapped[str | None]
    id: Mapped[int]
