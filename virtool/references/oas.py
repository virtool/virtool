from pydantic import Field, constr, root_validator, validator

from virtool.models import BaseModel
from virtool.models.validators import prevent_none

ALLOWED_DATA_TYPE = ["genome"]


def check_data_type(data_type: str) -> str:
    """Checks that the data type is valid."""
    if data_type not in ALLOWED_DATA_TYPE:
        raise ValueError("data type not allowed")

    return data_type


class CreateReferenceRequest(BaseModel):
    name: constr(strip_whitespace=True) = Field(
        default="",
        description="the virus name",
    )
    description: constr(strip_whitespace=True) = Field(
        default="",
        description="a longer description for the reference",
    )
    data_type: str = Field(default="genome", description="the sequence data type")
    organism: str = Field(default="", description="the organism")
    clone_from: int | str | None = Field(
        description="a valid ref_id that the new reference should be cloned from",
    )
    import_from: int | None = Field(
        description="the id of an upload to import the reference from",
    )

    _prevent_none = prevent_none(
        "clone_from",
        "import_from",
    )

    @root_validator
    def check_values(cls, values: str):
        """Check that only one reference source is used.

        Only one of clone_from or import_from may be used, if any.
        """
        if values.get("clone_from") and values.get("import_from"):
            raise ValueError("Only one of clone_from and import_from are allowed")

        return values

    _data_validation = validator("data_type", allow_reuse=True)(check_data_type)

    class Config:
        schema_extra = {
            "example": {
                "name": "Plant Viruses",
                "organism": "viruses",
                "data_type": "genome",
            },
        }


class UpdateReferenceRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None = Field(
        description="the virus name",
    )
    description: constr(strip_whitespace=True) | None = Field(
        description="a longer description for the reference",
    )
    organism: constr(strip_whitespace=True) | None = Field(
        description="the organism",
    )
    restrict_source_types: bool | None = Field(
        description="option to restrict source types",
    )
    source_types: list[constr(strip_whitespace=True, min_length=1)] | None = Field(
        description="source types",
    )

    _prevent_none = prevent_none(
        "description",
        "name",
        "organism",
        "restrict_source_types",
        "source_types",
    )

    class Config:
        schema_extra = {
            "example": {
                "name": "Regulated Pests",
                "organism": "phytoplasma",
            },
        }


class ReferenceRightsRequest(BaseModel):
    build: bool | None = Field(
        description="allow members to build new indexes for the reference",
    )
    modify: bool | None = Field(
        description="allow members to modify the reference metadata and settings",
    )
    modify_otu: bool | None = Field(
        description="allow members to modify the reference’s member OTUs",
    )

    class Config:
        schema_extra = {"example": {"build": True, "modify": True}}

    _prevent_none = prevent_none("*")


class CreateReferenceGroupRequest(ReferenceRightsRequest):
    group_id: int = Field(description="the id of the group to add")

    class Config:
        schema_extra = {"example": {"group_id": 2, "modify_otu": True}}


class CreateReferenceUserRequest(ReferenceRightsRequest):
    user_id: int = Field(description="the id of the user to add")

    class Config:
        schema_extra = {"example": {"user_id": "sidney", "modify_otu": True}}
