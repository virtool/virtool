from abc import ABC, abstractmethod

from faker import Faker
from faker.providers import misc

from virtool.utils import random_alphanumeric


class AbstractIdProvider(ABC):
    @abstractmethod
    def get(self) -> str:
        """Generate a new unique identifier for MongoDB.

        :return: a new unique identifier
        """
        ...


class FakeIdProvider(AbstractIdProvider):
    """A provider for generating predictable, fake, unique identifiers for MongoDB."""

    def __init__(self):
        self._faker = Faker()
        self._faker.seed_instance(9950)
        self._faker.add_provider(misc)

    def get(self) -> str:
        """Generate a fake unique identifier for MongoDB.

        IDs are generated using Faker with a static seed. The same IDs will be generated
        in the same order for a given provider instance.

        :return: a new unique identifier
        """
        return self._faker.md5()[:8]


class RandomIdProvider(AbstractIdProvider):
    """A provider for generating random, unique identifiers for MongoDB.

    This provider is used in production.
    """

    def get(self) -> str:
        return random_alphanumeric(8, True)
