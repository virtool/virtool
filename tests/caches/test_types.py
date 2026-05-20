import pytest

from virtool.caches.types import BaseCacheParams


class TestBaseCacheParams:
    def test_rejects_direct_instantiation(self):
        with pytest.raises(TypeError, match="abstract base"):
            BaseCacheParams()

    def test_allows_subclass_instantiation(self):
        class ConcreteParams(BaseCacheParams):
            value: int

        params = ConcreteParams(value=1)
        assert params.value == 1
