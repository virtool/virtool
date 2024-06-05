from faker import Faker
from virtool.fake.wrapper import FakerWrapper

def test_get_mongo_id(snapshot):
    wrapper = FakerWrapper()
    assert [wrapper.get_mongo_id() for _ in range(5)] == snapshot
