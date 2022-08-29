from abc import ABC, abstractmethod

from faker import Faker
from faker.providers import misc

from virtool.utils import random_alphanumeric


class AbstractIdProvider(ABC):
    @abstractmethod
    def get(self) -> str:
        ...


class FakeIdProvider(AbstractIdProvider):
    def __init__(self):
        self._faker = Faker()
        self._faker.seed_instance(9950)
        self._faker.add_provider(misc)

    def get(self) -> str:
        return self._faker.md5()[:8]


class RandomIdProvider(AbstractIdProvider):
    def get(self) -> str:
        return random_alphanumeric(8, True)
