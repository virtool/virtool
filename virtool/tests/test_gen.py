import pytest
import virtool.gen


def test_func():
    return "hello world"


class TestCoroutine:
    """
    Tests that the functions returned by virtool.gen.coroutine have the ``is_coroutine`` attribute.

    """
    def test_coroutine_attribute(self):
        cr = virtool.gen.coroutine(test_func)
        assert hasattr(cr, "is_coroutine")

    def test_wraps(self):
        wrapper = virtool.gen.exposed_method([])
        cr = wrapper(test_func)

        wrapped = cr.__wrapped__

        assert (wrapped.__name__ == "test_func")


class TestGen(TestCoroutine):

    def test_type(self):
        with pytest.raises(TypeError):
            virtool.gen.coroutine("hello world")

        with pytest.raises(TypeError):
            virtool.gen.coroutine(4)


class TestSynchronous(TestGen):

    def test_synchronous_attribute(self):
        cr = virtool.gen.synchronous(test_func)
        assert hasattr(cr, "is_synchronous")


class TestExposed(TestCoroutine):

    def test_exposed_attribute(self):
        wrapper = virtool.gen.exposed_method([])
        cr = wrapper(test_func)
        assert hasattr(cr, "is_exposed")

    def test_exposed_permissions(self):
        with pytest.raises(TypeError):
            wrapper = virtool.gen.exposed_method()


















