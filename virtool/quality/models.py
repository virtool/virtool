from virtool.models import BaseModel
from virtool.samples.models import Quality


class NucleotidePoint(BaseModel):
    g: float
    a: float
    t: float
    c: float


class QualityPoint(BaseModel):
    mean: float
    median: float
    lower_quartile: float
    upper_quartile: float
    tenth_percentile: float
    ninetieth_percentile: float


class Quality(BaseModel):
    """Sample quality data."""

    bases: list[list[int | float]]
    composition: list[list[int | float]]
    count: int
    encoding: str
    gc: int | float
    length: list[int]
    sequences: list[int]
