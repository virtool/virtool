"""
Errors that are raised by the data layer.

In most cases, data layer methods are called by API request handlers. The request
handler will catch these errors and return an appropriate response.

For example, a :class:`ResourceNotFoundError` will most likely precipitate a
**404 Not found** response.

To stop the data layer from becoming a leaky abstraction:

- Raise :class:`ResourceError` or its subclasses in the data layers methods. Do not
  allow service-specific exceptions (eg. :class:`~pymongo.errors.DuplicateKeyError`) to
  bubble up to the request handlers.
- Do not handle database or service exceptions in the data layer. Catch them and raise
  :class:``ResourceError`` or its subclasses instead.

"""


class ResourceError(Exception):
    """A base exception for data layer exceptions."""

    ...


class ResourceConflictError(ResourceError):
    """
    The operation could not be completed because it would conflict with an
    existing resource.

    In the context of a request handler, this error will generally result in a
    **400 Bad request**.

    Possible causes include:

    - A value for a unique field is already in use. For example, a request to create a
      sample uses a nane that is already used for an existing sample.
    - A resource is in a state where the requested operation cannot be completed. For
      example a completed job cannot be cancelled.
    - A resource referenced in the request does not exist. For example, a request to
      create an analysis refers to a non-existent sample.

    """

    ...


class ResourceNotFoundError(ResourceError):
    """
    The requested resource does not exist.

    In the context of a request handler, this error will generally result in a
    **404 Not found** response.

    This error is caused by a request to access or modify a resource that doesn't exist.
    If a resource is only related to the request and not accessed or modified directly,
    a :class:`ResourceConflictError` should be raised.

    Examples of when this error should be raised include:

    - A request to fetch a sample that doesn't exist.
    - A request to cancel a job that doesn't exist.
    - A request to remove a file that doesn't exist.
    - A request to fetch and OTU where the parent reference does not exist.
    - A request to add a file to a subtraction that doesn't exist.

    Examples of when a :class:`ResourceConflictError` should be raised include:

    - A request to create a sample where a provided default subtraction does not exist.
    - A request to apply a non-existent label to a sample.
    - A request to create a subtraction where the referenced FASTA upload does not
      exist.

    """

    ...


class ResourceNotModifiedError(ResourceError):
    """
    The resource has not been modified since a provided date.

    In the context of a request handler, this error will generally result in a
    **304 Not modified** response.

    Virtool currently supports `If-Modified-Since` headers only for fetching an
    analysis.

    """

    ...


class ResourceRemoteError(Exception):
    """
    An error was encountered while retrieving a resource that depends on a remote
    server.

    In the context of a request handler, this error will generally result in a
    **502 Bad gateway** response.

    An example of when this error should be raised is when Virtool is unable to retrieve
    a list of available remote references from
    https://www.virtool.ca/releases/references.json.

    """

    ...
