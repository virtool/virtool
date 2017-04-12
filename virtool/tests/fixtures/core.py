import pytest
import datetime
import virtool.web.dispatcher


@pytest.fixture
def static_time():
    return datetime.datetime(2017, 10, 6, 20, 0, 0, tzinfo=datetime.timezone.utc)


@pytest.fixture
def test_dispatch(mocker, monkeypatch):
    m = mocker.Mock(spec=virtool.web.dispatcher.Dispatcher())

    mock_class = mocker.Mock()
    mock_class.return_value = m

    monkeypatch.setattr("virtool.web.dispatcher.Dispatcher", mock_class)

    return m.dispatch
