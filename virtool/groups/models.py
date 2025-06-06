from virtool.models import SearchResult
from virtool.models.base import BaseModel
from virtool.users.models_base import UserNested


class Permissions(BaseModel):
    """The permissions possessed by a user and group."""

    cancel_job: bool = False
    create_ref: bool = False
    create_sample: bool = False
    modify_hmm: bool = False
    modify_subtraction: bool = False
    remove_file: bool = False
    remove_job: bool = False
    upload_file: bool = False


class GroupMinimal(BaseModel):
    id: int | str
    legacy_id: str | None
    name: str


class Group(GroupMinimal):
    permissions: Permissions
    users: list[UserNested]

    class Config:
        schema_extra = {
            "example": {
                "permissions": {
                    "cancel_job": True,
                    "create_ref": False,
                    "create_sample": True,
                    "modify_hmm": False,
                    "modify_subtraction": False,
                    "remove_file": False,
                    "remove_job": True,
                    "upload_file": True,
                },
                "id": "research",
                "name": "research",
                "users": [],
            },
        }


class GroupSearchResult(SearchResult):
    items: list[GroupMinimal]
