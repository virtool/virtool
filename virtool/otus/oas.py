from pydantic import Field, constr

from virtool.models import BaseModel
from virtool.models.validators import prevent_none
from virtool.otus.models import OTUSegment


class CreateOTURequest(BaseModel):
    """A request for creating a new OTU."""

    abbreviation: constr(strip_whitespace=True) = ""
    name: constr(min_length=1, strip_whitespace=True)
    otu_schema: list[OTUSegment] = Field(alias="schema", default_factory=list)


class UpdateOTURequest(BaseModel):
    """A request for updating an existing OTU."""

    abbreviation: constr(strip_whitespace=True) | None
    name: constr(min_length=1, strip_whitespace=True) | None
    otu_schema: list[OTUSegment] | None = Field(alias="schema")

    _prevent_none = prevent_none("*")


class CreateIsolateRequest(BaseModel):
    """A request for creating a new isolate."""

    default: bool = False
    source_name: constr(strip_whitespace=True) = ""
    source_type: constr(strip_whitespace=True) = ""


class UpdateIsolateRequest(BaseModel):
    """A request for updating an existing isolate."""

    source_name: constr(strip_whitespace=True) | None
    source_type: constr(strip_whitespace=True) | None

    _prevent_none = prevent_none("*")


class CreateSequenceRequest(BaseModel):
    """A request for creating a new sequence."""

    accession: constr(min_length=1, strip_whitespace=True)
    definition: constr(min_length=1, strip_whitespace=True)
    host: constr(strip_whitespace=True) = ""
    segment: str | None = None
    sequence: constr(min_length=1, regex=r"^[ATCGNRYKM]+$")
    target: str | None = None


class UpdateSequenceRequest(BaseModel):
    """A request for updating an existing sequence."""

    accession: constr(min_length=1, strip_whitespace=True) | None
    definition: constr(min_length=1, strip_whitespace=True) | None
    host: constr(strip_whitespace=True) | None
    segment: str | None
    sequence: constr(min_length=1, regex="^[ATCGNRYKM]+$") | None
    target: str | None

    _prevent_none = prevent_none("accession", "definition", "host", "sequence")
