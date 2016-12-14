import pytest
import virtool.gen

@pytest.fixture
def fake_func():
    def test_func():
        return "hello world"

    return test_func


class TestCoroutine:
    """
    Tests that the functions returned by virtool.gen.coroutine have the ``is_coroutine`` attribute.

    """
    def test_coroutine_attribute(self, fake_func):
        cr = virtool.gen.coroutine(fake_func)
        assert hasattr(cr, "is_coroutine")

    def test_wraps(self, fake_func):
        wrapper = virtool.gen.exposed_method([])
        cr = wrapper(fake_func)

        wrapped = cr.__wrapped__

        assert (wrapped.__name__ == "test_func")


class TestGen(TestCoroutine):

    def test_type(self):
        with pytest.raises(TypeError):
            virtool.gen.coroutine("hello world")

        with pytest.raises(TypeError):
            virtool.gen.coroutine(4)


class TestSynchronous(TestGen):

    def test_synchronous_attribute(self, fake_func):
        cr = virtool.gen.synchronous(fake_func)
        assert hasattr(cr, "is_synchronous")


class TestExposed(TestCoroutine):

    def test_exposed_attribute(self, fake_func):
        wrapper = virtool.gen.exposed_method([])
        cr = wrapper(fake_func)
        assert hasattr(cr, "is_exposed")

    def test_exposed_permissions(self):
        with pytest.raises(TypeError):
            virtool.gen.exposed_method()


















