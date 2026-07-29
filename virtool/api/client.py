from abc import ABC, abstractmethod

from virtool.models.roles import AdministratorRole


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
    def is_group_member(self, group_id: int) -> bool: ...

    @property
    @abstractmethod
    def is_job(self) -> bool: ...

    @property
    @abstractmethod
    def user_id(self) -> int | None: ...


class JobClient(AbstractClient):
    def __init__(self, job_id: int):
        self.job_id = job_id

    @property
    def administrator_role(self) -> None:
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

    def is_group_member(self, _: int) -> bool:
        return False

    @property
    def is_job(self) -> bool:
        return True

    @property
    def user_id(self) -> int | None:
        return None
