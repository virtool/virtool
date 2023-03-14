from typing import List, Optional

from pydantic import BaseModel, Field, constr
from virtool_core.models.otu import OTUSearchResult, OTUSegment
from virtool_core.models.validators import prevent_none


class CreateOTURequest(BaseModel):
    abbreviation: constr(strip_whitespace=True) = ""
    name: constr(min_length=1, strip_whitespace=True)
    otu_schema: List[OTUSegment] = Field(alias="schema", default_factory=list)


class UpdateOTURequest(BaseModel):
    abbreviation: Optional[constr(strip_whitespace=True)]
    name: Optional[constr(min_length=1, strip_whitespace=True)]
    otu_schema: Optional[List[OTUSegment]] = Field(alias="schema")

    _prevent_none = prevent_none("*")


class CreateIsolateRequest(BaseModel):
    default: bool = False
    source_name: constr(strip_whitespace=True) = ""
    source_type: constr(strip_whitespace=True) = ""


class UpdateIsolateRequest(BaseModel):
    source_name: Optional[constr(strip_whitespace=True)]
    source_type: Optional[constr(strip_whitespace=True)]

    _prevent_none = prevent_none("*")


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

    _prevent_none = prevent_none("accession", "definition", "host", "sequence")


class FindOTUsResponse(OTUSearchResult):
    class Config:
        schema_extra = {
            "example": {
                "documents": [
                    {
                        "abbreviation": "ABTV",
                        "id": "k77wgf8x",
                        "name": "Abaca bunchy top virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 18,
                    },
                    {
                        "abbreviation": "AbBV",
                        "id": "7hpwj4yh",
                        "name": "Abutilon Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "",
                        "id": "p9ohme8k",
                        "name": "Abutilon golden mosaic Yucatan virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AbMBoV",
                        "id": "qrspg5w3",
                        "name": "Abutilon mosaic Bolivia virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 6,
                    },
                    {
                        "abbreviation": "AbMoBrV",
                        "id": "yb7kpm43",
                        "name": "Abutilon mosaic Brazil virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 4,
                    },
                    {
                        "abbreviation": "AbMV",
                        "id": "8540rw7b",
                        "name": "Abutilon mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "3zwrpu3y",
                        "name": "Abutilon yellow mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AcLV",
                        "id": "30n6qo2x",
                        "name": "Aconitum latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "",
                        "id": "x5qw901r",
                        "name": "Actinidia chlorotic ringspot associated virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "",
                        "id": "ss6bios9",
                        "name": "Actinidia emaravirus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 13,
                    },
                    {
                        "abbreviation": "",
                        "id": "nn5gt7db",
                        "name": "Actinidia seed borne latent virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "xo3khtnd",
                        "name": "Actinidia virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "AVA",
                        "id": "qg8optks",
                        "name": "Actinidia virus A",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVB",
                        "id": "fnhtwiux",
                        "name": "Actinidia virus B",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AVX",
                        "id": "5uh1jzzk",
                        "name": "Actinidia virus X",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 1,
                    },
                    {
                        "abbreviation": "AYV1",
                        "id": "7ag9wwrr",
                        "name": "Actinidia yellowing virus 1",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AYV2",
                        "id": "f87f3cs7",
                        "name": "Actinidia yellowing virus 2",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "e2xpkmgy",
                        "name": "Adonis mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "3ly2pqbk",
                        "name": "Aeonium ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 0,
                    },
                    {
                        "abbreviation": "",
                        "id": "3xa1dbt0",
                        "name": "African cassava mosaic Burkina Faso virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 5,
                    },
                    {
                        "abbreviation": "ACMV",
                        "id": "0ommwgyh",
                        "name": "African cassava mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 9,
                    },
                    {
                        "abbreviation": "",
                        "id": "iyw0y3ta",
                        "name": "African eggplant mosaic virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "",
                        "id": "set9w2zc",
                        "name": "African eggplant yellowing virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 3,
                    },
                    {
                        "abbreviation": "AOPRV",
                        "id": "taecz4c9",
                        "name": "African oil palm ringspot virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                    {
                        "abbreviation": "",
                        "id": "zgsytbul",
                        "name": "Agave tequilana leaf virus",
                        "reference": {"id": "d19exr83"},
                        "verified": True,
                        "version": 2,
                    },
                ],
                "found_count": 2102,
                "modified_count": 1,
                "page": 1,
                "page_count": 85,
                "per_page": 25,
                "total_count": 2102,
            }
        }
