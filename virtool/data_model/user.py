from typing import List

from virtool_core.models.user import User


class VTUser(User):
    groups: List[str]
