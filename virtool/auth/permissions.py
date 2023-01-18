from dataclasses import dataclass
from enum import Enum
from typing import Union

from virtool.auth.models import ResourceType, Action


@dataclass
class Permission:
    id: str
    name: str
    description: str
    resource_type: str
    action: str


class AppPermission(Enum):
    cancel_job = Permission(
        id="cancel_job",
        name="Cancel Job",
        description="Allow cancellation of jobs.",
        resource_type=ResourceType.app,
        action=Action.cancel,
    )
    create_ref = Permission(
        id="create_ref",
        name="Create Ref",
        description="Allow creation of references.",
        resource_type=ResourceType.app,
        action=Action.create,
    )
    create_sample = Permission(
        id="create_sample",
        name="Create Sample",
        description="Allow creation of samples.",
        resource_type=ResourceType.app,
        action=Action.create,
    )
    modify_hmm = Permission(
        id="modify_hmm",
        name="Modify HMM",
        description="Allow modification of HMMs.",
        resource_type=ResourceType.app,
        action=Action.modify,
    )
    modify_subtraction = Permission(
        id="modify_subtraction",
        name="Modify Subtraction",
        description="Allow modification of subtractions.",
        resource_type=ResourceType.app,
        action=Action.modify,
    )
    remove_file = Permission(
        id="remove_file",
        name="Remove File",
        description="Allow removal of files.",
        resource_type=ResourceType.app,
        action=Action.remove,
    )
    remove_job = Permission(
        id="remove_job",
        name="Remove Job",
        description="Allow removal of jobs.",
        resource_type=ResourceType.app,
        action=Action.remove,
    )
    upload_file = Permission(
        id="upload_file",
        name="Upload File",
        description="Allow files to be uploaded.",
        resource_type=ResourceType.app,
        action=Action.upload,
    )
    create_user = Permission(
        id="create_user",
        name="Create User",
        description="Allow creation of users.",
        resource_type=ResourceType.app,
        action=Action.create,
    )
    update_user = Permission(
        id="update_user",
        name="Update User",
        description="Allow users to be updated.",
        resource_type=ResourceType.app,
        action=Action.update,
    )
    delete_user = Permission(
        id="delete_user",
        name="Delete User",
        description="Allow deletion of users.",
        resource_type=ResourceType.app,
        action=Action.delete,
    )
    update_user_permissions = Permission(
        id="update_user_permissions",
        name="Update User Permissions",
        description="Allow user permissions to be updated.",
        resource_type=ResourceType.app,
        action=Action.update,
    )
    update_settings = Permission(
        id="update_settings",
        name="Update Settings",
        description="Allow settings to be updated.",
        resource_type=ResourceType.app,
        action=Action.update,
    )
    create_group = Permission(
        id="create_group",
        name="Create Group",
        description="Allow creation of groups.",
        resource_type=ResourceType.app,
        action=Action.create,
    )
    update_group = Permission(
        id="update_group",
        name="Update Group",
        description="Allow groups to be updated.",
        resource_type=ResourceType.app,
        action=Action.update,
    )
    delete_group = Permission(
        id="delete_group",
        name="Delete Group",
        description="Allow creation of groups",
        resource_type=ResourceType.app,
        action=Action.delete,
    )


PermissionType = Union[AppPermission]
