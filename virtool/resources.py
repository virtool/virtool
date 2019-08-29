import psutil
from typing import List


def get_proc() -> List[float]:
    """
    Returns a CPU core-wise utilization percentages (eg. [1.0, 5.2, 3.1, 7.5]).

    :return: a list of CPU core utilization percentages

    """
    return psutil.cpu_percent(percpu=True)


def get_mem() -> dict:
    """
    Returns a `dict` showing total system memory and available memory.

    :return: system memory stats

    """
    mem = psutil.virtual_memory()

    return {
        "total": mem.total,
        "available": mem.available
    }


def get() -> dict:
    """
    Returns system CPU and memory resources.

    :return: CPU and memory resources
    """
    return {
        "proc": get_proc(),
        "mem": get_mem()
    }
