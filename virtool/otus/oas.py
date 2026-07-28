from pydantic import Field, constr

from virtool.models import BaseModel
from virtool.otus.models import OTUSegment


class CreateOTURequest(BaseModel):
    """A request for creating a new OTU."""

    abbreviation: constr(strip_whitespace=True) = ""
    name: constr(min_length=1, strip_whitespace=True)
    otu_schema: list[OTUSegment] = Field(alias="schema", default_factory=list)
