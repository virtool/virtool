"""All Virtool roles."""

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
    Full control over space and all resources, members, and groups.
    - Remove or add members.
    - Cancel any job.
    """

    CREATOR = "creator"
    """
    Create samples, subtractions, references, projects, uploads. Create, edit, and
    delete labels.
    """

    ANALYZER = "analyzer"
    """Create samples, projects, and uploads."""

    MEMBER = "member"
    """View resources only."""

    SAMPLE_MANAGER = "sample_manager"
    """Edit or delete any sample. Modify access control for individual samples."""

    SAMPLE_EDITOR = "sample_editor"
    """Edit any sample."""

    SAMPLE_VIEWER = "sample_viewer"
    """View any sample."""

    SUBTRACTION_MANAGER = "subtraction_manager"
    """Edit or delete any subtraction."""

    SUBTRACTION_EDITOR = "subtraction_editor"
    """Edit any subtraction."""

    SUBTRACTION_VIEWER = "subtraction_viewer"
    """View or use in analysis any subtraction."""

    REFERENCE_MANAGER = "reference_manager"
    """
    Edit, build, or delete any reference. Modify OTUs in any reference. Modify access
    control and settings for any reference.
    """

    REFERENCE_BUILDER = "reference_builder"
    """Edit and build references. Modify OTUs."""

    REFERENCE_EDITOR = "reference_editor"
    """Edit or modify OTUs for any reference."""

    REFERENCE_CONTRIBUTOR = "reference_contributor"
    """Create, edit, or delete (modify) OTUs in any reference."""

    REFERENCE_VIEWER = "reference_viewer"
    """View any and use in analysis any reference."""


class ProjectRole(Enum):
    """Roles that are assigned to users or groups for a specific project."""

    MANAGER = "manager"
    """Edit, delete, or manage access for the project and contained samples."""

    EDITOR = "editor"
    """Edit the project and contained samples."""

    CONTRIBUTOR = "contributor"
    """Edit samples in the project."""

    ANALYZE = "analyze"
    """Analyze samples in the project."""

    VIEWER = "viewer"
    """View the project and contained samples."""


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


class SampleRole(Enum):
    """Roles that are assigned to users or groups for a specific sample."""

    MANAGER = "manager"
    """Edit, analyze, delete, or modify access control for the sample."""

    EDITOR = "editor"
    """Edit or analyze the sample."""

    ANALYZER = "analyzer"
    """Analyze the sample."""

    VIEWER = "viewer"
    """View or analyze the sample."""
