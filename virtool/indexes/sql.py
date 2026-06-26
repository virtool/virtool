from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Integer,
    String,
    UniqueConstraint,
)

from virtool.pg.base import Base


class SQLIndexFile(Base):
    """SQL model to store new index files"""

    __tablename__ = "index_files"
    __table_args__ = (
        UniqueConstraint("index", "name"),
        CheckConstraint(
            "type IN ('json', 'ndjson', 'fasta', 'bowtie2')",
            name="index_file_type_valid",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    index = Column(String, nullable=False)
    type = Column(String)
    size = Column(BigInteger)
