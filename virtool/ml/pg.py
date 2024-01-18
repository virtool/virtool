import datetime
from typing import List

from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column

from virtool.pg.base import Base


class SQLMLModel(Base):
    """A class that represents a machine learning model stored in Postgres."""

    __tablename__ = "ml_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(default="", nullable=False)
    name: Mapped[str] = mapped_column(nullable=False, unique=True)

    releases: Mapped[List["SQLMLModelRelease"]] = relationship(
        back_populates="model",
        order_by="desc(SQLMLModelRelease.published_at)",
    )


class SQLMLModelRelease(Base):
    """
    A class that represents a release of a machine learning model stored in Postgres.
    """

    __tablename__ = "ml_model_releases"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    download_url: Mapped[str] = mapped_column(nullable=False)
    github_url: Mapped[str] = mapped_column(nullable=False)
    model_id: Mapped[int] = mapped_column(ForeignKey("ml_models.id"), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False, unique=True)
    published_at: Mapped[datetime.datetime] = mapped_column(nullable=False)
    ready: Mapped[bool] = mapped_column(nullable=False)
    size: Mapped[int] = mapped_column(nullable=False)

    model: Mapped["SQLMLModel"] = relationship(back_populates="releases", lazy="joined")
