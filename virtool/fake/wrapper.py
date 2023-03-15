"""
A wrapper for the `fake` package that adds some Virtool-specific functionality.

"""
from faker import Faker
from faker.providers import address, date_time, lorem, misc, profile, python

from virtool.fake.providers import MongoIDProvider, JobsProvider


class FakerWrapper:
    def __init__(self):
        self.fake = Faker()
        self.fake.seed_instance(0)
        self.fake.add_provider(address)
        self.fake.add_provider(misc)
        self.fake.add_provider(lorem)
        self.fake.add_provider(python)
        self.fake.add_provider(date_time)
        self.fake.add_provider(profile)
        self.fake.add_provider(JobsProvider)
        self.fake.add_provider(MongoIDProvider)

        self.country = self.fake.country

        self.text = self.fake.text
        self.word = self.fake.word
        self.words = self.fake.words

        self.integer = self.fake.pyint
        self.list = self.fake.pylist
        self.boolean = self.fake.pybool
        self.profile = self.fake.profile
        self.date_time = self.fake.date_time
        self.random_element = self.fake.random_element

    def get_mongo_id(self) -> str:
        """
        Create a predictable, fake ID for MongoDB that imitates Virtool IDs.

        :return: a fake MongoDB ID

        """
        return self.fake.password(length=8, special_chars=False)
