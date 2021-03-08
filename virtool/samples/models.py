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


class SampleArtifacts(Base):
    """
    SQL model to store sample artifacts

    """
    __tablename__ = "sample_artifacts"

    id = Column(Integer, primary_key=True)
    sample = Column(String)
    name = Column(String)
    name_on_disk = Column(String)
    size = Column(Integer)
    type = Column(Enum(ArtifactType))
    uploaded_at = Column(DateTime)


class SampleReadsFile(Base):
    """
    SQL model to store new sample reads files

    """
    __tablename__ = "sample_reads_files"

    id = Column(Integer, primary_key=True)
    sample = Column(String)
    name_on_disk = Column(String)
    paired = Column(Integer)
    size = Column(Integer)
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"<SampleReadsFile(id={self.id}, sample={self.sample}, name_on_disk={self.name_on_disk}, " \
               f"paired={self.paired}, size={self.size}, uploaded_at={self.uploaded_at})>"
