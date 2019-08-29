import virtool.resources
import pytest


@pytest.fixture
def proc_values():
    return [1.3, 78.2, 6.5, 21.6]


def test_get_proc(mocker, proc_values):
    """
    Test that expected `list` is returned and that backing system function is called.

    """
    m_cpu_percent = mocker.patch("psutil.cpu_percent", return_value=proc_values)

    result = virtool.resources.get_proc()

    assert result == proc_values
    m_cpu_percent.assert_called_with(percpu=True)


def test_get_mem(mocker):
    """
    Test that expected `dict` is returned.

    """
    class ReturnValue:
        total = 33627533312
        available = 22398033920

    m_virtual_memory = mocker.patch("psutil.virtual_memory", return_value=ReturnValue)

    result = virtool.resources.get_mem()

    assert result == {
        "total": 33627533312,
        "available": 22398033920
    }


def test_get(mocker, proc_values):
    """
    Test that the resource values are aggregated correctly.

    """
    mem_values = {
        "total": 33627533312,
        "available": 22398033920
    }

    m_get_proc = mocker.patch("virtool.resources.get_proc", return_value=proc_values)
    m_get_mem = mocker.patch("virtool.resources.get_mem", return_value=mem_values)

    result = virtool.resources.get()

    assert result == {
        "proc": proc_values,
        "mem": mem_values
    }
