import psutil

import virtool.nvstat


def get_cuda_devices():
    dev_list = virtool.nvstat.list_devices()

    for device in dev_list:
        index = device["index"]

        memory = virtool.nvstat.device_memory(index)
        clock = virtool.nvstat.device_clock(index)

        device.update({
            "total_memory": memory["FB"]["total"],
            "memory_clock": clock["max"]["memory"] / 1000000,
            "clock": clock["max"]["graphics"] / 1000000
        })

    return dev_list


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
