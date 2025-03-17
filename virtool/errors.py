"""Virtool excpetions."""


class AuthError(Exception):
    """An exception raised when authentication fails."""


class DatabaseError(Exception):
    """An exception raised when an error is encountered during a database operation."""


class GitHubError(Exception):
    """An exception raised when an error occurs while making a request to GitHub."""


class NCBIError(Exception):
    """An exception raised when an error occurs while making a request to NCBI."""


class PolicyError(Exception):
    """An exception raised when an API request violates the endpoint's access policy."""
