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

    def test_wrong_permissions_type(self):
        with pytest.raises(TypeError) as excinfo:
            virtool.gen.exposed_method("bad type")

        assert "permissions for an exposed method must be passed as a list" in str(excinfo.value)

    @pytest.mark.gen_test
    def test_too_many(self, mock_transaction):
        class TooMany:

            @virtool.gen.exposed_method([])
            def test_method(self, transaction):
                return True, dict(message="Failure"), "a"

        too_many = TooMany()

        message = {
            "interface": "test",
            "method": "test_method",
            "data": None
        }

        trans = mock_transaction(message, username="test", permissions="all")

        with pytest.raises(TypeError) as excinfo:
            yield too_many.test_method(trans)

        assert "must return a tuple of 2 items" in str(excinfo.value)

    @pytest.mark.gen_test
    def test_too_few(self, mock_transaction):
        class TooFew:
            @virtool.gen.exposed_method([])
            def test_method(self, transaction):
                return [True]

        too_few = TooFew()

        message = {
            "interface": "test",
            "method": "test_method",
            "data": None
        }

        trans = mock_transaction(message, username="test", permissions="all")

        with pytest.raises(TypeError) as excinfo:
            yield too_few.test_method(trans)

        assert "must return a tuple of 2 items" in str(excinfo.value)

    @pytest.mark.gen_test
    def test_not_iterable(self, mock_transaction):
        class NotIterable:
            @virtool.gen.exposed_method([])
            def test_method(self, transaction):
                return True

        not_iterable = NotIterable()

        message = {
            "interface": "test",
            "method": "test_method",
            "data": None
        }

        trans = mock_transaction(message, username="test", permissions="all")

        with pytest.raises(TypeError) as excinfo:
            yield not_iterable.test_method(trans)

        assert "must return a tuple of 2 items" in str(excinfo.value)

    @pytest.mark.gen_test
    def test_not_bool(self, mock_transaction):
        class NotBool:
            @virtool.gen.exposed_method([])
            def test_method(self, transaction):
                return "should be bool", dict(message="Failure")

        not_bool = NotBool()

        message = {
            "interface": "test",
            "method": "test_method",
            "data": None
        }

        trans = mock_transaction(message, username="test", permissions="all")

        with pytest.raises(TypeError) as excinfo:
            yield not_bool.test_method(trans)

        assert "must return a tuple of 2 items" in str(excinfo.value)





















