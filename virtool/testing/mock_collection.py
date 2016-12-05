import pytest.fixture
import virtool.gen


@pytest.fixture()
def with_exposed_method():
    return MockCollection


@pytest.fixture()
def without_exposed_method():
    return UnexposedMockCollection


class UnexposedMockCollection:

    def __init__(self, dispatch, collections):
        self.dispatch = dispatch
        self.collection = collections


class MockCollection(UnexposedMockCollection):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @virtool.gen.exposed_method([])
    def test_exposed_method(self, transaction):
        pass

