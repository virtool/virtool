"""All Virtool roles."""

from enum import Enum


class AdministratorRole(str, Enum):
    """Roles that are assigned to administrators."""

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
