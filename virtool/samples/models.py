from sqlalchemy import Column, DateTime, Enum, Integer, String

from virtool.pg.utils import Base, SQLEnum


class ArtifactType(str, SQLEnum):
    """
    Enumerated type for possible artifact types

    """

    sam = "sam"
    bam = "bam"
    fasta = "fasta"
    fastq = "fastq"
    csv = "csv"
    tsv = "tsv"
    json = "json"


class SampleArtifact(Base):
    """
    SQL model to store sample artifacts

    """
    __tablename__ = "sample_artifacts"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(Integer)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<SampleArtifact(id={self.id}, sample={self.sample}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, size={self.size}, type={self.type}, " \
               f"uploaded_at={self.uploaded_at}"


class SampleReadsFile(Base):
    """
    SQL model to store new sample reads files

    """
    __tablename__ = "sample_reads_files"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(Integer)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<SampleReadsFile(id={self.id}, sample={self.sample}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, size={self.size}, uploaded_at={self.uploaded_at})>"


class SampleArtifactCache(Base):
    """
    SQL model to store a cached sample artifact

    """
    __tablename__ = "sample_artifacts_cache"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String, nullable=False)
    name_on_disk = Column(String)
    size = Column(Integer)
    type = Column(Enum(ArtifactType), nullable=False)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<SampleArtifactCache(id={self.id}, sample={self.sample}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, size={self.size}, type={self.type}, " \
               f"uploaded_at={self.uploaded_at}"

    
class SampleReadsFileCache(Base):
    """
    SQL model to store cached sample reads files

    """
    __tablename__ = "sample_reads_files_cache"

    id = Column(Integer, primary_key=True)
    sample = Column(String, nullable=False)
    name = Column(String(length=13), nullable=False)
    name_on_disk = Column(String, nullable=False)
    size = Column(Integer)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<SampleReadsFileCache(id={self.id}, sample={self.sample}, name={self.name}, " \
               f"name_on_disk={self.name_on_disk}, size={self.size}, uploaded_at={self.uploaded_at})>"
