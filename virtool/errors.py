class DatabaseError(Exception):
    """Raised when an error occurs while accessing the database."""


class GitHubError(Exception):
    """Raised when an error occurs while communicating with GitHub."""


class NCBIError(Exception):
    """Raised when an error occurs while communicating with NCBI."""


class PolicyError(Exception):
    """Raised when a policy is violated."""
