from virtool.models.base import BaseModel


class SampleID(BaseModel):
    """A base model for samples that only includes the 'id' field."""

    id: str
    """The unique identifier for the sample"""


class SampleNested(SampleID):
    """A model for samples that can be nested in other models."""

    name: str
    """The name of the sample."""
