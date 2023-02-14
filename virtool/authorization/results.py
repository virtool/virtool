from dataclasses import dataclass


@dataclass
class AddRelationshipResult:
    """
    The result of adding one or more authorization relationships
    using the :class:`.AuthorizationClient`.

    :param added_count: The number of relationships that were added.
    :param exists_count: The number of relationships that already existed.
    """

    added_count: int
    exists_count: int


@dataclass
class RemoveRelationshipResult:
    """
    The result of removing one or more authorization relationships
    using the :class:`.AuthorizationClient`.

    :param not_found_count: The number of relationships that were not found.
    :param removed_count: The number of relationships that were removed.

    """

    not_found_count: int
    removed_count: int
