from abc import ABC, abstractmethod
from typing import Dict, Optional, Sequence, Union


class AbstractClient(ABC):
    @property
    @abstractmethod
    def authenticated(self) -> bool:
        ...

    @property
    @abstractmethod
    def administrator(self) -> bool:
        ...

    @property
    @abstractmethod
    async def force_reset(self) -> bool:
        ...

    @abstractmethod
    def has_permission(self, permission) -> bool:
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


class JobClient(AbstractClient):
    def __init__(self, job_id, rights: dict):
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
