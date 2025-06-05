from pydantic import BaseModel, root_validator


class VirtoolBaseModel(BaseModel):
    @root_validator(pre=True)
    def convert_id(cls, values):
        """Converts the "_id" field to "id"."""
        if "_id" in values:
            values["id"] = values.pop("_id")

        return values


class SearchResult(VirtoolBaseModel):
    found_count: int
    page: int
    page_count: int
    per_page: int
    total_count: int


class UserNested(VirtoolBaseModel):
    """A minimal representation of a user that can be nested in other models."""

    id: str
    """The unique ID of the user."""

    handle: str
    """The user's handle."""
