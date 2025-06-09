from pydantic import Field, constr, root_validator, validator

from virtool.models import BaseModel
from virtool.models.validators import prevent_none

ALLOWED_REMOTE = ["virtool/ref-plant-viruses"]
ALLOWED_DATA_TYPE = ["barcode", "genome"]


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
    release_id: str | None = Field(
        default=11447367,
        description="the id of the GitHub release to install",
    )
    clone_from: str | None = Field(
        description="a valid ref_id that the new reference should be cloned from",
    )
    import_from: str | None = Field(
        description="a valid file_id that the new reference should be imported from",
    )
    remote_from: str | None = Field(
        description="a valid GitHub slug to download and update the new reference from",
    )

    _prevent_none = prevent_none(
        "release_id",
        "clone_from",
        "import_from",
        "remote_from",
    )

    @root_validator
    def check_values(cls, values: str):
        """Check that the reference source is an allowable value.

        Only one of clone_from, import_from or remote_from may be used, if any.
        """
        clone_from, import_from, remote_from = (
            values.get("clone_from"),
            values.get("import_from"),
            values.get("remote_from"),
        )

        if clone_from:
            if import_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )
        elif import_from:
            if clone_from or remote_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )
        elif remote_from:
            if clone_from or import_from:
                raise ValueError(
                    "Only one of clone_from, import_from and remote_from are allowed",
                )

            if remote_from not in ALLOWED_REMOTE:
                raise ValueError("provided remote not allowed")

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


class ReferenceTargetRequest(BaseModel):
    name: constr(min_length=1)
    description: constr(strip_whitespace=True) = Field(default="")
    required: bool = Field(default=False)
    length: int | None

    _prevent_none = prevent_none("length")


class UpdateReferenceRequest(BaseModel):
    name: constr(strip_whitespace=True, min_length=1) | None = Field(
        description="the virus name",
    )
    description: constr(strip_whitespace=True) | None = Field(
        description="a longer description for the reference",
    )
    internal_control: str | None = Field(
        description="set the OTU identified by the passed id as the internal control for the reference",
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
    targets: list[ReferenceTargetRequest] | None = Field(
        description="list of target sequences",
    )

    _prevent_none = prevent_none(
        "description",
        "internal_control",
        "name",
        "organism",
        "restrict_source_types",
        "source_types",
        "targets",
    )

    class Config:
        schema_extra = {
            "example": {
                "name": "Regulated Pests",
                "organism": "phytoplasma",
                "internal_control": "ah4m5jqz",
            },
        }

    @validator("targets", check_fields=False)
    def check_targets_name(cls, targets):
        """Sets `name` to the provided `id` if it is `None`."""
        names = [t.name for t in targets]

        if len(names) != len(set(names)):
            raise ValueError("The targets field may not contain duplicate names")

        return targets


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
    remove: bool | None = Field(description="allow members to remove the reference")

    class Config:
        schema_extra = {"example": {"build": True, "modify": True}}

    _prevent_none = prevent_none("*")


class CreateReferenceGroupRequest(ReferenceRightsRequest):
    group_id: int = Field(description="the id of the group to add")

    class Config:
        schema_extra = {"example": {"group_id": 2, "modify_otu": True}}


class CreateReferenceUserRequest(ReferenceRightsRequest):
    user_id: str = Field(description="the id of the user to add")

    class Config:
        schema_extra = {"example": {"user_id": "sidney", "modify_otu": True}}
