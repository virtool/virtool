from abc import ABC, abstractmethod


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
        administrator: bool | None,
        force_reset: bool,
        groups: list[int | str],
        permissions: dict[str, bool],
        user_id: str | None,
        authenticated: bool,
        session_id: str | None = None,
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
    def __init__(self, job_id):
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
