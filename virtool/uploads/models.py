from sqlalchemy import Column, String, Boolean, Integer, DateTime

from virtool.postgres import Base


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime)
    field = Column(String)
    name = Column(String, unique=True)
    name_on_disk = Column(String, unique=True)
    ready = Column(Boolean)
    removed = Column(Boolean)
    reserved = Column(Boolean)
    size = Column(Integer)
    type = Column(String)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<Upload(id={self.id}, created_at={self.created_at}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, ready={self.ready}, reserved={self.reserved}, " \
               f"size={self.size}, type={self.type}, uploaded_at={self.uploaded_at}, user={self.user}"
