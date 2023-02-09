from dataclasses import dataclass
from enum import Enum
from logging import getLogger
from typing import Union

logger = getLogger("authz")

APP_ID = "virtool"


class ResourceType(Enum):
    """
    Types of resources a permission can apply to (e.g. 'app', 'sample', 'group').

    """

    APP = "app"
    """The application itself (eg. update_settings, create_user)"""
    REFERENCE = "reference"
    SPACE = "space"
    """
    A Virtool space.

    Used for controlling creation of resources in the space and manage space members and
    settings.
    """


class Action(Enum):
    """
    Conserved actions that can be performed on a resource and
    are controlled by permissions.
    """

    CANCEL = "cancel"
    """Allow a user to cancel a job."""

    CREATE = "create"
    """Allow a user to create a resource."""

    UPDATE = "update"
    """Allow a user to update a resource."""

    UPLOAD = "upload"
    """
    Allow a user to upload a file.

    This will be deprecated in favor of ``CREATE``.
    """

    MODIFY = "modify"
    """Allow a user to create or update a resource."""

    DELETE = "delete"
    """Allow a user to delete a resource."""

    REMOVE = "remove"
    """
    Allow a user to delete a resource.

    This will be deprecated in favor of ``DELETE``.
    """


@dataclass
class Permission:
    id: str
    name: str
    description: str
    resource_type: ResourceType
    action: Action


class LegacyPermission(Enum):
    REMOVE_FILE = Permission(
        id="remove_file",
        name="Remove File",
        description="Delete a user upload.",
        resource_type=ResourceType.SPACE,
        action=Action.DELETE,
    )
    UPLOAD_FILE = Permission(
        id="upload_file",
        name="Upload File",
        description="Upload a file.",
        resource_type=ResourceType.SPACE,
        action=Action.UPLOAD,
    )


class AppPermission(Enum):
    CREATE_USER = Permission(
        id="create_user",
        name="Create User",
        description="Allow creation of users.",
        resource_type=ResourceType.APP,
        action=Action.CREATE,
    )
    UPDATE_USER = Permission(
        id="update_user",
        name="Update User",
        description="Allow users to be updated.",
        resource_type=ResourceType.APP,
        action=Action.UPDATE,
    )
    DELETE_USER = Permission(
        id="delete_user",
        name="Delete User",
        description="Allow deletion of users.",
        resource_type=ResourceType.APP,
        action=Action.DELETE,
    )
    UPDATE_SETTINGS = Permission(
        id="update_settings",
        name="Update Settings",
        description="Allow settings to be updated.",
        resource_type=ResourceType.APP,
        action=Action.UPDATE,
    )

    @classmethod
    def from_string(cls, value: str) -> Permission:
        return cls[value]


class SpacePermission(Enum):
    CREATE_GROUP = Permission(
        id="create_group",
        name="Create Group",
        description="Allow creation of groups.",
        resource_type=ResourceType.SPACE,
        action=Action.CREATE,
    )
    UPDATE_GROUP = Permission(
        id="update_group",
        name="Update Group",
        description="Allow groups to be updated.",
        resource_type=ResourceType.SPACE,
        action=Action.UPDATE,
    )
    MODIFY_HMM = Permission(
        id="modify_hmm",
        name="Modify HMM",
        description="Allow modification of HMMs.",
        resource_type=ResourceType.SPACE,
        action=Action.MODIFY,
    )
    MODIFY_SUBTRACTION = Permission(
        id="modify_subtraction",
        name="Modify Subtraction",
        description="Allow modification of subtractions.",
        resource_type=ResourceType.SPACE,
        action=Action.MODIFY,
    )
    DELETE_GROUP = Permission(
        id="delete_group",
        name="Delete Group",
        description="Allow creation of groups",
        resource_type=ResourceType.SPACE,
        action=Action.DELETE,
    )
    CREATE_UPLOAD = Permission(
        id="create_upload",
        name="Create Upload",
        description="Allow files to be uploaded.",
        resource_type=ResourceType.SPACE,
        action=Action.CREATE,
    )
    DELETE_UPLOAD = Permission(
        id="delete_upload",
        name="Delete Upload",
        description="Allow user-uploaded files to be deleted.",
        resource_type=ResourceType.SPACE,
        action=Action.DELETE,
    )
    CREATE_REFERENCE = Permission(
        id="create_ref",
        name="Create Reference",
        description="Allow creation of references.",
        resource_type=ResourceType.SPACE,
        action=Action.CREATE,
    )
    CREATE_SAMPLE = Permission(
        id="create_sample",
        name="Create Sample",
        description="Allow creation of samples.",
        resource_type=ResourceType.SPACE,
        action=Action.CREATE,
    )
    CANCEL_JOB = Permission(
        id="cancel_job",
        name="Cancel Job",
        description="Allow cancellation of jobs.",
        resource_type=ResourceType.SPACE,
        action=Action.CANCEL,
    )

    @classmethod
    def from_string(cls, value: str):
        if value == "create_ref":
            value = "create_reference"

        return cls[value.upper()]
