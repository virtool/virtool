import psutil
import pycuda.driver


def get_cuda_devices():
    pycuda.driver.init()
    count = pycuda.driver.Device.count()

    dev_list = list()

    for i in range(count):
        dev = pycuda.driver.Device(i)

        dev_list.append({
            "index": i,
            "name": dev.name(),
            "total_memory": round(dev.total_memory() / 1073741824),
            "clock": round(dev.CLOCK_RATE / 1000, 3),
            "memory_clock": round(dev.MEMORY_CLOCK_RATE / 500, 3)
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
