from enum import Enum
from sqlalchemy.orm import registry


def as_declarative(**kw):
    _, metadata, class_registry = (
        kw.pop("bind", None),
        kw.pop("metadata", None),
        kw.pop("class_registry", None),
    )

    return registry(
        metadata=metadata, class_registry=class_registry
    ).as_declarative_base(**kw)


@as_declarative()
class Base:
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
