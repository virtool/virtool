from typing import Optional, List

from pydantic import constr, BaseModel, Field
from virtool_core.models.otu import OTUSegment


class CreateOTURequest(BaseModel):
    abbreviation: constr(strip_whitespace=True) = ""
    name: constr(min_length=1, strip_whitespace=True)
    otu_schema: List[OTUSegment] = Field(alias="schema", default_factory=list)


class UpdateOTURequest(BaseModel):
    abbreviation: Optional[constr(strip_whitespace=True)]
    name: Optional[constr(min_length=1, strip_whitespace=True)]
    otu_schema: Optional[List[OTUSegment]] = Field(alias="schema")


class CreateIsolateRequest(BaseModel):
    default: bool = False
    source_name: constr(strip_whitespace=True) = ""
    source_type: constr(strip_whitespace=True) = ""


class UpdateIsolateRequest(BaseModel):
    source_name: Optional[constr(strip_whitespace=True)]
    source_type: Optional[constr(strip_whitespace=True)]


class CreateSequenceRequest(BaseModel):
    accession: constr(min_length=1, strip_whitespace=True)
    definition: constr(min_length=1, strip_whitespace=True)
    host: constr(strip_whitespace=True) = ""
    segment: Optional[str] = None
    sequence: constr(min_length=1, strip_whitespace=True)
    target: Optional[str] = None


class UpdateSequenceRequest(BaseModel):
    accession: Optional[constr(min_length=1, strip_whitespace=True)]
    definition: Optional[constr(min_length=1, strip_whitespace=True)]
    host: Optional[constr(strip_whitespace=True)]
    segment: Optional[str]
    sequence: Optional[constr(min_length=1, strip_whitespace=True)]
    target: Optional[str]
