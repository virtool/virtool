from enum import Enum

from sqlalchemy.ext.declarative import declarative_base


class Base:

    def __repr__(self):
        params = ', '.join(f'{column}={value}' for column, value in self.to_dict().items())

        return f"<{self.__class__.__name__}({params})>"

    def to_dict(self):
        row = dict()

        for column in self.__table__.columns:
            value = getattr(self, column.name, None)

            # Enums cannot serialize to JSON
            row[column.name] = value if not isinstance(value, Enum) else value.value

        return row


Base = declarative_base(cls=Base)
