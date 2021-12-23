from abc import ABC, abstractmethod
from typing import Dict, Optional, Sequence, Union

from virtool.http.rights import MODIFY, READ, REMOVE, Right
from virtool.jobs.utils import JobRights


class AbstractClient(ABC):
    @property
    @abstractmethod
    async def authenticated(self) -> bool:
        ...

    @property
    @abstractmethod
    async def administrator(self) -> bool:
        ...

    @property
    @abstractmethod
    async def force_reset(self) -> bool:
        ...

    @abstractmethod
    async def has_permission(self, permission) -> bool:
        ...

    @abstractmethod
    async def has_right_on_analysis(self, analysis_id: str, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_hmms(self, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_index(self, index_id: str, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_reference(self, reference_id: str, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_sample(self, sample_id: str, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_subtraction(self, subtraction_id: str, right: Right) -> bool:
        ...

    @abstractmethod
    async def has_right_on_upload(self, upload_id: str, right: Right) -> bool:
        ...


class UserClient(AbstractClient):
    def __init__(
        self,
        db,
        administrator: bool,
        force_reset: bool,
        groups: Sequence[str],
        permissions: Dict[str, bool],
        user_id: Union[str, None],
        authenticated: bool,
        session_id: Optional[str] = None,
    ):
        self._db = db
        self._force_reset = force_reset
        self._administrator = administrator
        self._authenticated = authenticated
        self.groups = groups
        self.permissions = permissions
        self.user_id = user_id
        self.session_id = session_id

    @property
    def authenticated(self) -> bool:
        return self._authenticated

    @property
    def administrator(self) -> bool:
        return self._administrator

    @property
    def force_reset(self) -> bool:
        return self._force_reset

    def has_permission(self, permission: str) -> bool:
        return self.permissions.get(permission, False)

    async def has_right_on_analysis(self, analysis_id: str, right: Right) -> bool:
        return True

    async def has_right_on_hmms(self, right: Right):
        if right == READ:
            return True

        if right == MODIFY or right == REMOVE:
            return self.has_permission("modify_hmm")

    async def has_right_on_index(self, index_id: str, right: Right) -> bool:
        return True if right == READ else False

    async def has_right_on_sample(self, sample_id: str, right: Right) -> bool:
        if self.administrator:
            return True

        sample = await self._db.find_one(sample_id, {"quality": False})

        if self.user_id == sample["user"]["id"]:
            return True

        is_group_member = sample["group"] and sample["group"] in self.groups

        if right == READ:
            return sample["all_read"] or (is_group_member and sample["group_read"])

        if right == MODIFY or right == REMOVE:
            return sample["all_write"] or (is_group_member and sample["group_write"])

    async def has_right_on_reference(self, reference_id: str, right: Right):
        return False

    async def has_right_on_subtraction(self, subtraction_id: str, right: Right):
        """
        Check whether the authenticated user has the passed ``right`` on a subtraction.

        User rights on subtractions are based on group permissions.

        """
        if right == READ:
            return True

        if right == MODIFY:
            return self.has_permission("modify_subtraction")

        if right == REMOVE:
            return self.has_permission("delete_subtraction")

    async def has_right_on_upload(self, upload_id: str, right: Right) -> bool:
        if right == REMOVE:
            return self.has_permission("remove_file")

        if right == MODIFY:
            return False

        return True


class JobClient(AbstractClient):
    def __init__(self, job_id, rights: JobRights):
        self._rights = rights
        self.job_id = job_id

    @property
    def authenticated(self) -> bool:
        return True

    @property
    def administrator(self):
        return False

    @property
    def force_reset(self) -> bool:
        return False

    def has_permission(self, permission: str) -> bool:
        return False

    async def has_right_on_analysis(self, analysis_id: str, right: Right) -> bool:
        return self._rights.analyses.has_right(analysis_id, right)

    async def has_right_on_hmms(self, right: Right) -> bool:
        """
        Check whether the client has a right on HMMs.

        All jobs can read HMMs. None can modify or remove them.

        :param right: the right to check for

        """
        if right == READ:
            return True

        return False

    async def has_right_on_index(self, index_id, right):
        return self._rights.indexes.has_right(index_id, right)

    async def has_right_on_reference(self, reference_id: str, right: Right) -> bool:
        return self._rights.references.has_right(reference_id, right)

    async def has_right_on_sample(self, sample_id: str, right: Right) -> bool:
        return self._rights.samples.has_right(sample_id, right)

    async def has_right_on_subtraction(self, subtraction_id: str, right: Right) -> bool:
        return self._rights.subtractions.has_right(subtraction_id, right)

    async def has_right_on_upload(self, upload_id: str, right: Right) -> bool:
        return self._rights.uploads.has_right(upload_id, right)
