class ResourceError(Exception):
    ...


class ResourceConflictError(Exception):
    """
    The requested operation could not be completed because it would conflict with an
    existing resource
    """

    ...


class ResourceNotFoundError(Exception):
    """
    The requested resource does not exist.
    """

    ...


class ResourceNotModifiedError(Exception):
    """
    The resource has not been modified since a provided cache header value.

    Virtool currently supports `If-Modified-Since` headers for some resources.

    """

    ...


class ResourceRemoteError(Exception):
    """
    An error was encountered while retrieving a resource that depends on a remote
    server

    """

    ...
