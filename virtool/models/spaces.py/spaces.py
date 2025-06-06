from datetime import datetime
from typing import Optional, List

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.roles import (
    SpaceRole,
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)
from virtool_core.models.user import UserNested


class SpaceMember(UserNested):
    role: SpaceRole
    label_role: Optional[SpaceLabelRole]
    project_role: Optional[SpaceProjectRole]
    reference_role: Optional[SpaceReferenceRole]
    sample_role: Optional[SpaceSampleRole]
    subtraction_role: Optional[SpaceSubtractionRole]
    upload_role: Optional[SpaceUploadRole]


class SpaceNested(BaseModel):
    id: int
    name: str


class SpaceMinimal(SpaceNested):
    description: str


class Space(SpaceMinimal):
    created_at: datetime
    updated_at: datetime
    members: List[SpaceMember]


class MemberSearchResult(BaseModel):
    items: List[SpaceMember]
    available_roles: List[dict]
