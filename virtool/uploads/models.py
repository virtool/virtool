import enum

from sqlalchemy import Column, String, Boolean, Integer, DateTime, Enum

from virtool.postgres import Base


class UploadType(str, enum.Enum):
    hmm = "hmm"
    reference = "reference"
    reads = "reads"
    subtraction = "subtraction"


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime)
    name = Column(String)
    name_on_disk = Column(String, unique=True)
    ready = Column(Boolean)
    removed = Column(Boolean)
    removed_at = Column(DateTime)
    reserved = Column(Boolean)
    size = Column(Integer)
    type = Column(Enum(UploadType))
    user = Column(String)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<Upload(id={self.id}, created_at={self.created_at}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, ready={self.ready}, removed={self.removed}, " \
               f"reserved={self.reserved}, " f"size={self.size}, type={self.type}, user={self.user}, " \
               f"uploaded_at={self.uploaded_at})>"
