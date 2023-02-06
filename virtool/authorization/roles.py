"""All Virtool roles."""
from ctypes import Union
from enum import Enum


class AdministratorRole(Enum):
    """Roles that are assigned to administrators.

    These roles are relations between users and the application object. The take the
    following form in OpenFGA:
    ```
    (user:bob, full_administrator, app:virtool)
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


class SpaceRole(Enum):
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

    LABEL_MANAGER = "label_manager"
    """Create, edit, or delete labels."""

    PROJECT_MANAGER = "manager"
    """Create, edit, or delete projects."""

    PROJECT_EDITOR = "editor"
    """Create or edit projects."""

    PROJECT_VIEWER = "viewer"
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


class ReferenceRole(Enum):
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
