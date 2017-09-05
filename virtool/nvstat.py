import subprocess


BASE_COMMAND = ["nvidia-smi"]


def convert_memory_value(value_string):
    """
    Convert a memory value from nvidia-smi into a value in bytes.

    :param value_string: the memory value (eg. 100 MiB)
    :type value_string: str

    :return: a memory value in bytes
    :rtype: int

    """
    value, unit = value_string.split(" ")
    value = float(value)

    if unit == "KiB":
        return value * 1024

    if unit == "MiB":
        return value * 1024 * 1024

    raise ValueError("Could not parse memory value {}".format(value_string))


def convert_clock_value(value_string):
    """
    Convert a clock value from nvidia-smi into a value in hertz.

    :param value_string: the clock value (eg. 100 KHz)
    :type value_string: str

    :return: a clock value in hertz
    :rtype: int

    """
    value, unit = value_string.split(" ")
    value = float(value)

    if unit == "KHz":
        return value * 1000

    if unit == "MHz":
        return value * 1000000

    if unit == "GHz":
        return value * 1000000000

    raise ValueError("Could not parse clock value {}".format(value_string))


def driver_version():
    """
    Get the installed Nvidia driver version.

    :return: the driver version
    :rtype: str

    """
    try:
        output = subprocess.check_output(BASE_COMMAND).decode("utf-8").rstrip().split("\n")
    except FileNotFoundError:
        raise FileNotFoundError("nvidia-smi could not be called. Make sure it is installed")
    except subprocess.CalledProcessError as err:
        if "couldn't communicate with NVIDIA driver" in err.output.decode():
            raise NVDriverError("Couldn't communicate with NVIDIA driver")
        raise

    for line in output:
        if "Driver Version" in line:
            return line.split("Driver Version: ")[1].split(" ")[0]


def list_devices():
    """
    List the Nvidia devices on the system. The result will be a :class:`list` of :class:`dict`s describing the devices
    on the system.

    :return: a list of descriptive dicts
    :rtype: list

    """
    try:
        output = subprocess.check_output(BASE_COMMAND + ["-L"]).decode("utf-8").rstrip().split("\n")
    except FileNotFoundError:
        raise FileNotFoundError("nvidia-smi could not be called. Make sure it is installed")
    except subprocess.CalledProcessError as err:
        if "couldn't communicate with the NVIDIA driver" in err.output.decode():
            raise NVDriverError("Couldn't communicate with NVIDIA driver")
        raise

    device_list = list()

    for line in output:
        device_dict = dict()

        # Extract device UUID
        split = line.strip().split("(UUID: ")
        device_dict["uuid"] = split[1].replace(")", "")

        # Extract device model name.
        split = split[0].split(":")
        device_dict["model"] = split[1].strip()

        # Extract device index.
        device_dict["index"] = int(split[0].replace("GPU ", ""))

        device_list.append(device_dict)

    return device_list


def device_memory(index):
    """
    Returns a description of the memory on the device. This includes PCI bar and frame buffer memory.

    :param index: the index of the device to query
    :type index: int

    :return: a description of the memory on the device
    :rtype: dict

    """
    command = BASE_COMMAND + ["-i", str(index), "-d", "MEMORY", "-q"]

    try:
        output = subprocess.check_output(command, stderr=subprocess.STDOUT)
    except FileNotFoundError:
        raise FileNotFoundError("nvidia-smi could not be called. Make sure it is installed")
    except subprocess.CalledProcessError as err:
        if "couldn't communicate with NVIDIA driver" in err.output.decode():
            raise NVDriverError("Couldn't communicate with NVIDIA driver")
        raise

    if output == "No devices were found":
        raise IndexError("No device with index {}".format(index))

    result = {
        "FB": dict(),
        "BAR1": dict()
    }

    mode = False

    for line in output.decode().split("\n"):
        if "FB Memory Usage" in line:
            mode = "FB"
        elif "BAR1 Memory Usage" in line:
            mode = "BAR1"

        if not mode:
            continue

        if ":" in line:
            key, value = [s.strip() for s in line.split(":")]
            result[mode][key.lower()] = convert_memory_value(value)

    return result


def device_clock(index):
    """
    Returns a description of the clocks on the device. This includes the base and maximum memory and GPU clock values.s

    :param index: the index of the device to query
    :type index: int

    :return: a description of the clocks on the device
    :rtype: dict

    """
    try:
        output = subprocess.check_output(BASE_COMMAND + ["-i", str(index), "-d", "CLOCK", "-q"])
    except FileNotFoundError:
        raise FileNotFoundError("nvidia-smi could not be called. Make sure it is installed")
    except subprocess.CalledProcessError as err:
        if "couldn't communicate with NVIDIA driver" in err.output.decode():
            raise NVDriverError("Couldn't communicate with NVIDIA driver")
        raise

    if output == "No devices were found":
        raise IndexError("No device with index {}".format(index))

    mode = False

    result = {
        "base": dict(),
        "max": dict()
    }

    for line in output.decode().split("\n"):
        if line.startswith(8 * " ") and ":" in line:
            if not mode:
                continue
            else:
                key, value = [s.strip() for s in line.split(":")]
                result[mode][key.lower()] = convert_clock_value(value)

        elif line.startswith("    Clocks"):
            mode = "base"

        elif line.startswith("    Max Clocks"):
            mode = "max"

        else:
            mode = False

    return result


class NVDriverError(Exception):
    pass
