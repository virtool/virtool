"""
Permissions for checking a user's ability to access a request handler.

"""
from enum import Enum
from typing import Union


class ResourceType(str, Enum):
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


class LegacyPermission(str, Enum):
    """
    Global permissions for Virtool.



    """

    CANCEL_JOB = "cancel_job"
    CREATE_REF = "create_ref"
    CREATE_SAMPLE = "create_sample"
    MODIFY_HMM = "modify_hmm"
    MODIFY_SUBTRACTION = "modify_subtraction"
    REMOVE_FILE = "remove_file"
    REMOVE_JOB = "remove_job"
    UPLOAD_FILE = "upload_file"


class Permission(str, Enum):
    CREATE_LABEL = "create_label"
    """Create a label in a space."""
    UPDATE_LABEL = "update_label"
    """Update any label in a space."""
    DELETE_LABEL = "delete_label"
    """Delete any label in a space."""

    VIEW_PROJECT = "view_project"
    """View any project in a space."""
    CREATE_PROJECT = "create_project"
    """Create a project in a space."""
    UPDATE_PROJECT = "update_project"
    """Update any project in a space."""
    DELETE_PROJECT = "delete_project"
    """Delete any project in a space."""

    VIEW_REFERENCE = "view_reference"
    """View any reference in a space."""
    BUILD_REFERENCE = "build_reference"
    """Build a new index for any reference in a space."""
    CREATE_REFERENCE = "create_reference"
    """Create a new reference in a space."""
    UPDATE_REFERENCE = "update_reference"
    """Update any reference in a space."""
    CONTRIBUTE_REFERENCE = "contribute_reference"
    """Contribute OTU changes to any reference in a space."""
    DELETE_REFERENCE = "delete_reference"
    """Delete any reference in a space."""

    VIEW_SAMPLE = "view_sample"
    """View any sample in a space."""
    ANALYZE_SAMPLE = "analyze_sample"
    """Analyze any sample in a space."""
    CREATE_SAMPLE = "create_sample"
    """Create a new sample in a space."""
    UPDATE_SAMPLE = "update_sample"
    """Update any sample in a space."""
    DELETE_SAMPLE = "delete_sample"
    """Delete any sample in a space."""

    VIEW_SUBTRACTION = "view_subtraction"
    """View any subtraction in a space."""
    CREATE_SUBTRACTION = "create_subtraction"
    """Create a new subtraction in a space."""
    UPDATE_SUBTRACTION = "update_subtraction"
    """Update any subtraction in a space."""
    DELETE_SUBTRACTION = "delete_subtraction"
    """Delete any subtraction in a space."""

    CREATE_UPLOAD = "create_upload"
    """Upload a file to a space."""
    DELETE_UPLOAD = "delete_upload"
    """Delete any upload in a space."""


class ReferencePermission(str, Enum):
    VIEW_REFERENCE = "view_reference"
    """View any reference in a space."""
    BUILD_REFERENCE = "build_reference"
    """Build a new index for any reference in a space."""
    CREATE_REFERENCE = "create_reference"
    """Create a new reference in a space."""
    UPDATE_REFERENCE = "update_reference"
    """Update any reference in a space."""
    CONTRIBUTE_REFERENCE = "contribute_reference"
    """Contribute OTU changes to any reference in a space."""
    DELETE_REFERENCE = "delete_reference"
    """Delete any reference in a space."""


def adapt_permission_new_to_legacy(
    permission: Union[Permission, ReferencePermission]
) -> LegacyPermission:
    """
    Return a legacy permission that corresponds to the provided new-style permission.
    If the provided permission is already a legacy style permission, it is returned.
    :param permission: a permission
    :return: the permission
    """
    if permission in (
        Permission.DELETE_SUBTRACTION,
        Permission.UPDATE_SUBTRACTION,
        Permission.CREATE_SUBTRACTION,
    ):
        return LegacyPermission.MODIFY_SUBTRACTION

    if permission == Permission.CREATE_UPLOAD:
        return LegacyPermission.UPLOAD_FILE

    if permission == Permission.DELETE_UPLOAD:
        return LegacyPermission.REMOVE_FILE

    if permission == Permission.CREATE_REFERENCE:
        return LegacyPermission.CREATE_REF

    raise ValueError(f"Unknown permission: {permission}")
