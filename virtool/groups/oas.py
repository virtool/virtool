"""Request and response models use to validate requests and autogenerate the OpenAPI
specification.
"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints
from virtool_core.models.group import Group

from virtool.validation import RequestModel, Unset, UnsetType


class PermissionsUpdate(BaseModel):
    """Possible permissions that will be updated for a user and group."""

    cancel_job: bool | None = None
    create_ref: bool | None = None
    create_sample: bool | None = None
    modify_hmm: bool | None = None
    modify_subtraction: bool | None = None
    remove_file: bool | None = None
    remove_job: bool | None = None
    upload_file: bool | None = None


class GroupCreateRequest(RequestModel):
    """A schema for requests to create groups."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"name": "Research"},
        },
    )

    name: Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
    """A name for the group."""


class GroupCreateResponse(Group):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "permissions": {
                    "cancel_job": True,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": True,
                    "upload_file": True,
                },
                "id": "research",
                "name": "research",
                "users": [],
            },
        },
    )


class GroupUpdateRequest(RequestModel):
    """A request validation model for updating groups."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"permissions": {"create_ref": True}, "name": "Managers"},
        },
    )

    name: Annotated[str | UnsetType, StringConstraints(min_length=1)] = Unset
    """A name for the group."""

    permissions: PermissionsUpdate | UnsetType = Unset
    """A permission update comprising an object keyed by permission names with
    boolean values."""


class GroupResponse(Group):
    """A response model for a group."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "permissions": {
                    "cancel_job": True,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": True,
                    "upload_file": True,
                },
                "id": "technicians",
                "name": "technicians",
                "users": [
                    {
                        "administrator": False,
                        "b2c": None,
                        "b2c_display_name": None,
                        "b2c_family_name": None,
                        "b2c_given_name": None,
                        "b2c_oid": None,
                        "handle": "leeashley",
                        "id": "7CtBo2yG",
                    },
                ],
            },
        },
    )
