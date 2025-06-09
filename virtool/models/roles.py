"""All Virtool roles."""
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


class SpaceLabelRole(str, Enum):
    MANAGER = "label_manager"
    """Create, edit, or delete labels."""


class SpaceProjectRole(str, Enum):
    """Roles that control space member access to all projects in the space."""

    MANAGER = "project_manager"
    """Create, edit, or delete projects."""

    EDITOR = "project_editor"
    """Create or edit projects."""

    VIEWER = "project_viewer"
    """View projects."""


class SpaceReferenceRole(str, Enum):
    """Roles that control space member access to all references in the space."""

    MANAGER = "reference_manager"
    """
    Edit, build, contribute to (modify otus), or delete any reference. Modify access
    control and settings for any reference.
    """

    BUILDER = "reference_builder"
    """Edit, build, and contribute to any reference."""

    EDITOR = "reference_editor"
    """Edit or contribute to any reference."""

    CONTRIBUTOR = "reference_contributor"
    """Create, edit, or delete (modify) OTUs in any reference."""

    VIEWER = "reference_viewer"
    """View any and use any reference."""


class SpaceSampleRole(str, Enum):
    """Roles that control space member access to all samples in the space."""

    MANAGER = "sample_manager"
    """Create, edit, or delete samples."""

    EDITOR = "sample_editor"
    """Create or edit samples."""

    ANALYZER = "sample_analyzer"
    """Analyze samples."""

    VIEWER = "sample_viewer"
    """View samples."""


class SpaceSubtractionRole(str, Enum):
    """Roles that control space member access to all subtractions in the space."""

    MANAGER = "subtraction_manager"
    """Create, edit, or delete subtractions."""

    EDITOR = "subtraction_editor"
    """Edit subtractions."""

    VIEWER = "subtraction_viewer"
    """View or use subtractions."""


class SpaceUploadRole(str, Enum):
    """Roles that control space member access to all uploads in the space."""

    MANAGER = "upload_manager"
    """Create, use, or delete uploads."""

    VIEWER = "upload_viewer"
    """View or use uploads."""


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


SpaceRoleType = (
    SpaceRole
    | SpaceLabelRole
    | SpaceProjectRole
    | SpaceReferenceRole
    | SpaceSampleRole
    | SpaceSubtractionRole
    | SpaceUploadRole
)

RoleType = AdministratorRole | SpaceRoleType | ReferenceRole
