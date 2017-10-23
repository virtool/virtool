import psutil


def get_proc():
    return psutil.cpu_percent(percpu=True)


def get_mem():
    mem = psutil.virtual_memory()

    return {
        "total": mem.total,
        "available": mem.available
    }


def get():
    return {
        "proc": get_proc(),
        "mem": get_mem()
    }
