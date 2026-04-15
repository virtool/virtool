"""Errors raised by storage operations."""


class StorageError(Exception):
    """Base exception for storage operations."""


class StorageKeyNotFoundError(StorageError):
    """The requested key does not exist in storage."""
