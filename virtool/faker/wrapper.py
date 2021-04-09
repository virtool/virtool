from faker import Faker
from faker.providers import misc

class FakerWrapper:

    def __init__(self):
        self.fake = Faker()
        self.fake.seed_instance(0)
        self.fake.add_provider(misc)

    def get_mongo_id(self):
        return self.fake.password(length=8, special_chars=False)
