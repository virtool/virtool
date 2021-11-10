from faker import Faker
from virtool.fake.wrapper import FakerWrapper


def test_wraps():
    wrapper = FakerWrapper()
    assert isinstance(wrapper.fake, Faker)


def test_get_mongo_id(snapshot):
    wrapper = FakerWrapper()
    assert [wrapper.get_mongo_id() for _ in range(5)] == snapshot
