import arrow
import types
import pytest
import virtool.app_dispatcher


@pytest.fixture
def test_random_alphanumeric(monkeypatch):
    class RandomAlphanumericTester:

        def __init__(self):
            self.choices = [
                "aB67nm89jL56hj34AL90",
                "fX1l90Rt45JK34bA7890",
                "kl84Fg067jJa109lmQ021"
            ]

            self.history = list()

            self.last_choice = None

        def __call__(self, length=6, mixed_case=False, excluded=None):
            string = self.choices.pop()[:length]

            if not mixed_case:
                string = string.lower()

            if string in excluded:
                string = self.__call__(length, mixed_case, excluded)

            self.history.append(string)
            self.last_choice = string

            return string

        @property
        def next_choice(self):
            return self.choices[-1]

    tester = RandomAlphanumericTester()

    monkeypatch.setattr("virtool.utils.random_alphanumeric", tester)

    return tester


@pytest.fixture
def static_time(monkeypatch):
    time = arrow.Arrow(2017, 10, 6, 20, 0, 0).naive

    monkeypatch.setattr("virtool.utils.timestamp", lambda: time)

    return time


@pytest.fixture
def test_dispatch(mocker, monkeypatch):

    m = mocker.Mock(spec=virtool.app_dispatcher.Dispatcher())

    m.connections = list()

    m.dispatch_stub = mocker.stub(name="dispatch")

    async def dispatch(self, *args, **kwargs):
        self.dispatch_stub(*args, **kwargs)

    dispatch.stub = m.dispatch_stub

    m.dispatch = types.MethodType(dispatch, m)

    mock_class = mocker.Mock()
    mock_class.return_value = m

    monkeypatch.setattr("virtool.app_dispatcher.Dispatcher", mock_class)

    return m.dispatch
