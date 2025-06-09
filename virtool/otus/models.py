from pydantic import Field, root_validator

from virtool.history.models import HistoryNested
from virtool.models import BaseModel, SearchResult
from virtool.models.enums import Molecule
from virtool.references.models import ReferenceNested


class OTUMinimal(BaseModel):
    abbreviation: str
    id: str
    name: str
    reference: ReferenceNested
    verified: bool
    version: int


class OTURemote(BaseModel):
    id: str


class OTUSequence(BaseModel):
    """A sequence nested in an OTU.

    It does not include a nested reference field as this is included in the parent OTU.
    """

    accession: str
    definition: str
    host: str | None = Field(default="")
    id: str
    remote: OTURemote | None
    segment: str | None
    sequence: str
    target: str | None


class Sequence(OTUSequence):
    """A complete sequence resource as returned for sequence API requests."""

    otu_id: str
    reference: ReferenceNested


class OTUIsolate(BaseModel):
    default: bool
    id: str
    sequences: list[OTUSequence]
    source_name: str
    source_type: str


class OTUSegment(BaseModel):
    molecule: Molecule | None
    name: str
    required: bool

    @root_validator(pre=True)
    def make_molecule_nullable(cls, values):
        """Convert unset molecule fields from empty strings to ``None``."""
        if values["molecule"] == "":
            values["molecule"] = None

        return values


class OTU(OTUMinimal):
    isolates: list[OTUIsolate]
    issues: dict | bool | None
    last_indexed_version: int | None
    most_recent_change: HistoryNested
    otu_schema: list[OTUSegment] = Field(alias="schema")
    remote: OTURemote | None


class OTUSearchResult(SearchResult):
    documents: list[OTUMinimal]
    modified_count: int
