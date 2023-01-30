from dataclasses import dataclass


@dataclass
class AddRelationshipResult:
    added_count: int
    exists_count: int


@dataclass
class RemoveRelationshipResult:
    not_found_count: int
    removed_count: int
