"""
A wrapper for the `fake` package that adds some Virtool-specific functionality.

"""
from faker import Faker
from faker.providers import misc, lorem, python


class FakerWrapper:
    def __init__(self):
        self.fake = Faker()
        self.fake.seed_instance(0)
        self.fake.add_provider(misc)
        self.fake.add_provider(lorem)
        self.fake.add_provider(python)

        self.text = self.fake.text
        self.words = self.fake.words

        self.integer = self.fake.pyint
        self.list = self.fake.pylist
        self.boolean = self.fake.pybool

    def get_mongo_id(self) -> str:
        """
        Create a predictable, fake ID for MongoDB that imitates Virtool IDs.

        :return: a fake MongoDB ID

        """
        return self.fake.password(length=8, special_chars=False)
