from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String

Base = declarative_base()


class Label(Base):
    __tablename__ = 'labels'

    id = Column(String, primary_key=True)
    name = Column(String, unique=True)
    color = Column(String)
    description = Column(String)

    def __repr__(self):
        return "<Label(name='%s', color='%s', description='%s')>" % (
            self.name, self.color, self.description)


async def create_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
