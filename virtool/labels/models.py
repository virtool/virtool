from sqlalchemy import Column, String, Sequence, Integer

from virtool.postgres import Base


class Label(Base):
    __tablename__ = 'labels'

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    color = Column(String(length=7))
    description = Column(String)

    def __repr__(self):
        return "<Label(id= '%s', name='%s', color='%s', description='%s')>" % (
            self.id, self.name, self.color, self.description)
