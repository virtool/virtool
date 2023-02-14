"""All Virtool roles."""
from typing import Union
from enum import Enum


class AdministratorRole(str, Enum):
    """Roles that are assigned to administrators.

    These roles are relations between users and the application object. The take the
    following form in OpenFGA:
    ```
    (user:bob, full, app:virtool)
    ```
    """

    FULL = "full"
    """Manage who is an administrator and what they can do."""

    SETTINGS = "settings"
    """Manage instance settings and administrative messages."""

    SPACES = "spaces"
    """Manage users in any space. Delete any space."""

    USERS = "users"
    """Create user accounts. Control activation of user accounts."""

    BASE = "base"
    """
    Provides ability to:
    - Create new spaces even if the `Free Spaces` setting is not enabled.
    - Manage HMMs and common references.
    - View all running jobs.
    - Cancel any job.
    """


class SpaceRole(str, Enum):
    """
    Roles that are bestowed to users in a space.

    Un-prefixed base roles are ones that apply to the space directly. Only one can be
    selected at a time.

    Prefixed base roles are ones that apply to specific resource types in the space.
    Only one base role per resource type can be selected at a time.

    """

    OWNER = "owner"
    """
    Full control over space a and all resources and members.
    - Remove or add members.
    - Cancel any job.
    """

    MEMBER = "member"
    """Access a space."""


class SpaceResourceRole(str, Enum):
    LABEL_MANAGER = "label_manager"
    """Create, edit, or delete labels."""

    PROJECT_MANAGER = "project_manager"
    """Create, edit, or delete projects."""

    PROJECT_EDITOR = "project_editor"
    """Create or edit projects."""

    PROJECT_VIEWER = "project_viewer"
    """View projects."""

    REFERENCE_MANAGER = "reference_manager"
    """
    Edit, build, contribute to (modify otus), or delete any reference. Modify access
    control and settings for any reference.
    """

    REFERENCE_BUILDER = "reference_builder"
    """Edit, build, and contribute to any reference."""

    REFERENCE_EDITOR = "reference_editor"
    """Edit or contribute to any reference."""

    REFERENCE_CONTRIBUTOR = "reference_contributor"
    """Create, edit, or delete (modify) OTUs in any reference."""

    REFERENCE_VIEWER = "reference_viewer"
    """View any and use any reference."""

    SAMPLE_MANAGER = "sample_manager"
    """Create, edit, and delete sample."""

    SAMPLE_EDITOR = "sample_editor"
    """Create and edit samples."""

    SAMPLE_ANALYZER = "sample_analyzer"
    """Analyze samples."""

    SAMPLE_VIEWER = "sample_viewer"
    """View samples."""

    SUBTRACTION_MANAGER = "subtraction_manager"
    """Create, edit, or delete subtractions."""

    SUBTRACTION_EDITOR = "subtraction_editor"
    """Edit subtractions."""

    SUBTRACTION_VIEWER = "subtraction_viewer"
    """View or use subtractions."""


class ReferenceRole(str, Enum):
    """Roles that are assigned to users or groups for a specific reference."""

    MANAGER = "manager"
    """
    Edit, build, delete, or manage access and settings for the reference. Create, edit,
    or delete OTUs.
    """

    BUILDER = "builder"
    """Edit and build the reference. Create, edit, or delete OTUs."""

    EDITOR = "editor"
    """Edit the reference. Create, edit, or delete OTUs."""

    CONTRIBUTOR = "contributor"
    """Create, edit, or delete OTUs in the reference."""

    VIEWER = "viewer"
    """View the reference and OTUs."""


RoleType = Union[AdministratorRole, SpaceRole, ReferenceRole]


class LabelPermission(str, Enum):
    DELETE_LABEL = "delete_label"
    """Allows labels to be deleted."""

    CREATE_LABEL = "create_label"
    """Allows labels to be created."""

    EDIT_LABEL = "edit_label"
    """Allows labels to be edited."""


class ProjectPermission(str, Enum):
    DELETE_PROJECT = "delete_project"
    """Allows projects to be deleted."""

    CREATE_PROJECT = "create_project"
    """Allows projects to be created."""

    EDIT_PROJECT = "edit_project"
    """Allows projects to be edited."""

    VIEW_PROJECT = "view_project"
    """ Allows projects to be viewed."""


class SamplePermission(str, Enum):
    DELETE_SAMPLE = "delete_sample"
    """Allows samples to be deleted."""

    CREATE_SAMPLE = "create_sample"
    """Allows samples to be created."""

    EDIT_SAMPLE = "edit_sample"
    """Allows samples to be edited."""

    ANALYZE_SAMPLE = "analyze_sample"
    """Allows samples to be analyzed."""

    VIEW_SAMPLE = "view_sample"
    """ Allows samples to be viewed."""


class SubtractionPermission(str, Enum):
    DELETE_SUBTRACTION = "delete_subtraction"
    """Allows subtractions to be deleted."""

    CREATE_SUBTRACTION = "create_subtraction"
    """Allows subtractions to be created."""

    EDIT_SUBTRACTION = "edit_subtraction"
    """Allows subtractions to be edited."""

    VIEW_SUBTRACTION = "view_subtraction"
    """ Allows subtractions to be viewed."""


class ReferencePermission(str, Enum):
    DELETE_REFERENCE = "delete_reference"
    """Allows references to be deleted."""

    BUILD_REFERENCE = "build_reference"
    """Allows references to be built."""

    EDIT_REFERENCE = "edit_reference"
    """Allows references to be edited."""

    CONTRIBUTE_REFERENCE = "contribute_reference"
    """Allows references to be contributed to."""

    VIEW_REFERENCE = "view_reference"
    """ Allows references to be viewed."""


class UploadPermission(str, Enum):
    CREATE_UPLOAD = "create_upload"
    """Allows files to be uploaded."""

    DELETE_UPLOAD = "delete_upload"
    """Allows files to be deleted."""


class HMMPermission(str, Enum):
    MODIFY_HMM = "modify_hmm"
    """Allows Hmms to be modified."""


class JobPermission(str, Enum):
    CANCEL_JOB = "cancel_job"
    """Allows jobs to be canceled."""


class LegacyPermission(str, Enum):
    MODIFY_SUBTRACTION = "modify_subtraction"

    UPLOAD_FILE = "upload_file"

    REMOVE_FILE = "remove_file"

    CREATE_REF = "create_ref"


PermissionType = Union[
    LabelPermission,
    SamplePermission,
    ProjectPermission,
    ReferencePermission,
    SubtractionPermission,
    UploadPermission,
    HMMPermission,
    JobPermission,
    LegacyPermission,
]


def adapt_permission_new_to_legacy(permission: PermissionType) -> PermissionType:
    """
    Return a legacy permission that corresponds to the provided new-style permission.
    If the provided permission is already a legacy style permission, it is returned.
    :param permission: a permission
    :return: the permission
    """
    if permission in (
        SubtractionPermission.DELETE_SUBTRACTION,
        SubtractionPermission.EDIT_SUBTRACTION,
        SubtractionPermission.CREATE_SUBTRACTION,
    ):
        return LegacyPermission.MODIFY_SUBTRACTION

    if permission == UploadPermission.CREATE_UPLOAD:
        return LegacyPermission.UPLOAD_FILE

    if permission == UploadPermission.DELETE_UPLOAD:
        return LegacyPermission.REMOVE_FILE

    if permission == ReferencePermission.BUILD_REFERENCE:
        return LegacyPermission.CREATE_REF

    return permission
