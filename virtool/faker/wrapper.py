from faker import Faker
from faker.providers import misc

class FakerWrapper(Faker):
    fake = Faker()
    Faker.seed(0)
    fake.add_provider(misc)

    def get_mongo_id(self):
        return self.fake.password(length=8, special_chars=False)
