from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints
from virtool_core.models.roles import (
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)

from virtool.validation import Unset, UnsetType


class SpacesListResponse(BaseModel):
    """A response model for a list of spaces."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {"id": 0, "name": "Space 0", "description": "The default space."},
            ],
        },
    )


class SpaceResponse(BaseModel):
    """A response model for a space."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 0,
                "name": "Space 0",
                "description": "",
                "created_at": "2015-10-06T20:00:00Z",
                "updated_at": "2015-10-06T20:00:00Z",
                "created_by": "test",
                "members": [
                    {
                        "id": "test",
                        "administrator": True,
                        "handle": "bob",
                        "label": None,
                        "project": None,
                        "reference": None,
                        "role": "owner",
                        "sample": None,
                        "subtraction": None,
                        "upload": None,
                    },
                ],
            },
        },
    )


class SpaceUpdateRequest(BaseModel):
    """A request validation model for updating a space."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"name": "My Space"}},
        use_attribute_docstrings=True,
    )

    name: Annotated[str | UnsetType, StringConstraints(strip_whitespace=True)] = Unset
    """The name of the space."""

    description: Annotated[str, StringConstraints(strip_whitespace=True)] = ""
    """A description for the space."""


class SpaceUpdateResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 0,
                "name": "My Space",
                "description": "",
                "created_at": "2015-10-06T20:00:00Z",
                "updated_at": "2015-10-06T20:00:00Z",
                "created_by": "test",
                "members": [
                    {
                        "id": "test",
                        "administrator": True,
                        "handle": "bob",
                        "label": None,
                        "project": None,
                        "reference": None,
                        "role": "owner",
                        "sample": None,
                        "subtraction": None,
                        "upload": None,
                    },
                ],
            },
        },
    )


class SpaceListMembersResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [
                    {
                        "id": "test",
                        "administrator": True,
                        "handle": "bob",
                        "label": None,
                        "project": None,
                        "reference": None,
                        "role": "owner",
                        "sample": None,
                        "subtraction": None,
                        "upload": None,
                    },
                ],
                "available_roles": [
                    {
                        "id": "owner",
                        "name": "Owner",
                        "description": "Full control over space a and all resources and members.\n- Remove or add "
                        "members.\n- Cancel any job.",
                    },
                    {
                        "id": "member",
                        "name": "Member",
                        "description": "Access a space.",
                    },
                    {
                        "id": "label_manager",
                        "name": "Label_manager",
                        "description": "Create, edit, or delete labels.",
                    },
                    {
                        "id": "project_manager",
                        "name": "Project_manager",
                        "description": "Create, edit, or delete projects.",
                    },
                    {
                        "id": "project_editor",
                        "name": "Project_editor",
                        "description": "Create or edit projects.",
                    },
                    {
                        "id": "project_viewer",
                        "name": "Project_viewer",
                        "description": "View projects.",
                    },
                    {
                        "id": "reference_manager",
                        "name": "Reference_manager",
                        "description": "Edit, build, contribute to (modify otus), or delete any reference. Modify access\ncontrol and settings for any reference.",
                    },
                    {
                        "id": "reference_builder",
                        "name": "Reference_builder",
                        "description": "Edit, build, and contribute to any reference.",
                    },
                    {
                        "id": "reference_editor",
                        "name": "Reference_editor",
                        "description": "Edit or contribute to any reference.",
                    },
                    {
                        "id": "reference_contributor",
                        "name": "Reference_contributor",
                        "description": "Create, edit, or delete (modify) OTUs in any reference.",
                    },
                    {
                        "id": "reference_viewer",
                        "name": "Reference_viewer",
                        "description": "View any and use any reference.",
                    },
                    {
                        "id": "sample_manager",
                        "name": "Sample_manager",
                        "description": "Create, edit, or delete samples.",
                    },
                    {
                        "id": "sample_editor",
                        "name": "Sample_editor",
                        "description": "Create or edit samples.",
                    },
                    {
                        "id": "sample_analyzer",
                        "name": "Sample_analyzer",
                        "description": "Analyze samples.",
                    },
                    {
                        "id": "sample_viewer",
                        "name": "Sample_viewer",
                        "description": "View samples.",
                    },
                    {
                        "id": "subtraction_manager",
                        "name": "Subtraction_manager",
                        "description": "Create, edit, or delete subtractions.",
                    },
                    {
                        "id": "subtraction_editor",
                        "name": "Subtraction_editor",
                        "description": "Edit subtractions.",
                    },
                    {
                        "id": "subtraction_viewer",
                        "name": "Subtraction_viewer",
                        "description": "View or use subtractions.",
                    },
                    {
                        "id": "upload_manager",
                        "name": "Upload_manager",
                        "description": "Create, use, or delete uploads.",
                    },
                    {
                        "id": "upload_viewer",
                        "name": "Upload_viewer",
                        "description": "View or use uploads.",
                    },
                ],
            },
        },
    )


class SpaceMemberUpdateRequest(BaseModel):
    """Used when updating the roles of a member in the space."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"role": "member"}},
        use_attribute_docstrings=True,
    )

    role: SpaceRole | UnsetType = Unset
    label: SpaceLabelRole | UnsetType = Unset
    project: SpaceProjectRole | UnsetType = Unset
    reference: SpaceReferenceRole | UnsetType = Unset
    sample: SpaceSampleRole | UnsetType = Unset
    subtraction: SpaceSubtractionRole | UnsetType = Unset
    upload: SpaceUploadRole | UnsetType = Unset


class UpdateMemberResponse(BaseModel):
    """A response model for updating a member."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {
                    "id": "test",
                    "administrator": True,
                    "handle": "bob",
                    "label": None,
                    "project": None,
                    "reference": None,
                    "role": "member",
                    "sample": None,
                    "subtraction": None,
                    "upload": None,
                },
            ],
        },
    )
