from abc import ABC, abstractmethod

from virtool_core.models.roles import AdministratorRole


class AbstractClient(ABC):
    @property
    @abstractmethod
    def authenticated(self) -> bool: ...

    @property
    @abstractmethod
    def administrator_role(self) -> AdministratorRole | None: ...

    @property
    @abstractmethod
    def force_reset(self) -> bool: ...

    @abstractmethod
    def has_permission(self, permission: str) -> bool: ...

    @abstractmethod
    def is_group_member(self, group_id: str) -> bool: ...

    @property
    @abstractmethod
    def is_job(self) -> bool: ...

    @property
    @abstractmethod
    def user_id(self) -> str | None: ...




class JobClient(AbstractClient):
    def __init__(self, job_id: str):
        self.job_id = job_id

    @property
    def administrator_role(self) -> AdministratorRole | None:
        """The administrator role of the job."""
        return None

    @property
    def authenticated(self) -> bool:
        return True

    @property
    def force_reset(self) -> bool:
        return False

    @property
    def groups(self):
        return []

    def has_permission(self, permission: str) -> bool:
        return False

    def is_group_member(self, _: str) -> bool:
        return False

    @property
    def is_job(self) -> bool:
        return True

    @property
    def user_id(self) -> str | None:
        return None


class UserClient(AbstractClient):
    def __init__(
        self,
        administrator_role: AdministratorRole | None,
        authenticated: bool,
        force_reset: bool,
        groups: list[int | str],
        permissions: dict[str, bool],
        user_id: str | None,
        session_id: str | None = None,
    ):
        self._administrator_role = administrator_role
        self._authenticated = authenticated
        self._force_reset = force_reset
        self._groups = groups
        self._user_id = user_id

        self.groups = groups
        self.permissions = permissions
        self.session_id = session_id

    @property
    def authenticated(self) -> bool:
        return self._authenticated

    @property
    def administrator_role(self) -> AdministratorRole | None:
        return self._administrator_role

    @property
    def force_reset(self) -> bool:
        return self._force_reset

    def has_permission(self, permission: str) -> bool:
        return self.permissions.get(permission, False)

    def is_group_member(self, group_id: str) -> bool:
        return group_id in self.groups

    @property
    def is_job(self) -> bool:
        return False

    @property
    def user_id(self) -> str | None:
        return self._user_id
