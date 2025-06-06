from datetime import datetime

from virtool.models import BaseModel
from virtool.models.roles import (
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)
from virtool.users.models_base import UserNested


class SpaceMember(UserNested):
    role: SpaceRole
    label_role: SpaceLabelRole | None
    project_role: SpaceProjectRole | None
    reference_role: SpaceReferenceRole | None
    sample_role: SpaceSampleRole | None
    subtraction_role: SpaceSubtractionRole | None
    upload_role: SpaceUploadRole | None


class SpaceNested(BaseModel):
    id: int
    name: str


class SpaceMinimal(SpaceNested):
    description: str


class Space(SpaceMinimal):
    created_at: datetime
    updated_at: datetime
    members: list[SpaceMember]


class MemberSearchResult(BaseModel):
    items: list[SpaceMember]
    available_roles: list[dict]
