from enum import Enum

from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


def to_dict(self):
    row = dict()
    for c in self.__table__.columns:
        column = getattr(self, c.name, None)

        row[c.name] = column if not isinstance(column, Enum) else column.value

    return row


Base.to_dict = to_dict
