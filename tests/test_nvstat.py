import pytest
import subprocess

import virtool.nvstat


class TestConvertMemoryValue:

    @pytest.mark.parametrize("value_string,expected", [("526 KiB", 538624), ("124 MiB", 130023424)])
    def test(self, value_string, expected):
        """
        Test that a memory size string as expected from nvidia-smi can be parsed to an ``int`` bytes value.

        """
        assert virtool.nvstat.convert_memory_value(value_string) == expected

    def test_unknown_unit(self):
        """
        Test that an unknown unit suffix results in a TypeError.

        """
        with pytest.raises(ValueError) as err:
            virtool.nvstat.convert_memory_value("201 FooB")

        assert "Could not parse memory value 201 FooB" in str(err)


class TestConvertClockValue:

    @pytest.mark.parametrize("value_string,expected", [("5 KHz", 5000), ("1.2 MHz", 1200000), ("1.1 GHz", 1100000000)])
    def test(self, value_string, expected):
        """
        Test that a clock value string as expected from nvidia-smi can be parsed to an ``int`` hertz value.

        """
        assert virtool.nvstat.convert_clock_value(value_string) == expected

    def test_unknown_unit(self):
        """
        Test that an unknown unit suffix results in a TypeError.

        """
        with pytest.raises(ValueError) as err:
            virtool.nvstat.convert_clock_value("1.5 FooHz")

        assert "Could not parse clock value 1.5 FooHz" in str(err)


class TestDriverVersion:

    def test(self, mocker):
        """
        Test that the driver version can be parsed out if everything is working properly.

        """
        return_value = bytes((
            "Wed Jun 28 10:15:13 2017\n"
            "+-----------------------------------------------------------------------------+\n"
            "| NVIDIA-SMI 375.66                 Driver Version: 555.55                    |\n"
            "|-------------------------------+----------------------+----------------------+\n"
            "| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |\n"
            "| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |\n"
            "|===============================+======================+======================|\n"
            "|   0  GeForce GTX 1080    Off  | 0000:06:00.0      On |                  N/A |\n"
            "|  0%   46C    P8    11W / 198W |   1699MiB /  8110MiB |     12%      Default |\n"
            "+-------------------------------+----------------------+----------------------+\n"
            "                                                                               \n"
            "+-----------------------------------------------------------------------------+\n"
            "| Processes:                                                       GPU Memory |\n"
            "|  GPU       PID  Type  Process name                               Usage      |\n"
            "|=============================================================================|\n"
            "|    0      5183    G   /usr/lib/xorg/Xorg                            1201MiB |\n"
            "|    0      7326    G   cinnamon                                       262MiB |\n"
            "|    0      7511    G   ...el-token=3AC7789447AEC469F8CF8195C364C622   172MiB |\n"
            "|    0     14813    G   /proc/self/exe                                  61MiB |\n"
            "+-----------------------------------------------------------------------------+"
        ), encoding="utf-8")

        mocker.patch("subprocess.check_output", new=lambda x: return_value)

        assert virtool.nvstat.driver_version() == "555.55"

    def test_no_smi(self, no_smi):
        """
        Test the a FileNotFound exception is raised is nvidia-smi is not available.

        """
        with pytest.raises(FileNotFoundError) as err:
            virtool.nvstat.driver_version()

        assert no_smi(err)

    def test_no_driver(self, no_driver):
        """
        Test the NVDriverError is raised the driver can't be found.

        """
        with pytest.raises(virtool.nvstat.NVDriverError) as err:
            virtool.nvstat.driver_version()

        assert no_driver(err)

    def test_process_error(self, nv_unhandled_error):
        """
        Test that unhandled ``CalledProcessErrors`` can still be raised.

        """
        with pytest.raises(subprocess.CalledProcessError):
            virtool.nvstat.driver_version()


class TestListDevices:

    def test(self, mocker):
        """
        Test that a device list can be parsed from valid nvidia-smi output.

        """
        return_value = bytes((
            "GPU 0: GeForce GTX 1080 (UUID: GPU-b334763a-21fa-1302-5dff-1eaecd0f5428)\n"
            "GPU 1: GeForce GTX 1080 (UUID: GPU-b334763a-21fa-1302-5dff-1skjlekas980)\n"
            "GPU 2: GeForce GTX 1080 (UUID: GPU-b334763a-21fa-1302-5dff-9djaskkn2l31)\n"
        ), encoding="utf-8")

        mocker.patch("subprocess.check_output", lambda x: return_value)

        output = virtool.nvstat.list_devices()

        assert output == [
            {"uuid": "GPU-b334763a-21fa-1302-5dff-1eaecd0f5428", "model": "GeForce GTX 1080", "index": 0},
            {"uuid": "GPU-b334763a-21fa-1302-5dff-1skjlekas980", "model": "GeForce GTX 1080", "index": 1},
            {"uuid": "GPU-b334763a-21fa-1302-5dff-9djaskkn2l31", "model": "GeForce GTX 1080", "index": 2}
        ]

    def test_no_smi(self, no_smi):
        """
        Test the a FileNotFound exception is raised is nvidia-smi is not available.

        """
        with pytest.raises(FileNotFoundError) as err:
            virtool.nvstat.list_devices()

        assert no_smi(err)

    def test_no_driver(self, no_driver):
        """
        Test the NVDriverError is raised the driver can't be found.

        """
        with pytest.raises(virtool.nvstat.NVDriverError) as err:
            virtool.nvstat.list_devices()

        assert no_driver(err)

    def test_process_error(self, nv_unhandled_error):
        """
        Test that unhandled ``CalledProcessErrors`` can still be raised.

        """
        with pytest.raises(subprocess.CalledProcessError) as err:
            virtool.nvstat.list_devices()


class TestDeviceMemory:

    def test(self, mocker):
        """
        Test that the device memory can be parsed from nvidia-smi when provided a valid device index.

        """
        return_value = bytes((
            "==============NVSMI LOG==============\n"
            "\n"
            "Timestamp                           : Wed Jun 28 11:21:36 2017\n"
            "Driver Version                      : 375.66\n"
            "\n"
            "Attached GPUs                       : 1\n"
            "GPU 0000:06:00.0\n"
            "    FB Memory Usage\n"
            "        Total                       : 8110 MiB\n"
            "        Used                        : 1796 MiB\n"
            "        Free                        : 6314 MiB\n"
            "    BAR1 Memory Usage\n"
            "        Total                       : 256 MiB\n"
            "        Used                        : 5 MiB\n"
            "        Free                        : 251 MiB\n"
            ""
        ), encoding="utf-8")

        m = mocker.Mock(return_value=return_value)

        mocker.patch("subprocess.check_output", new=m)

        assert virtool.nvstat.device_memory(0) == {
            "FB": {
                "used": 1883242496,
                "free": 6620708864,
                "total": 8503951360
            },
            "BAR1": {
                "used": 5242880,
                "free": 263192576,
                "total": 268435456
            }
        }

    def test_no_device(self, mocker):
        """
        Test that an IndexError is raised when the passed device index does not exist.

        """
        m = mocker.Mock(return_value="No devices were found")

        mocker.patch("subprocess.check_output", new=m)

        with pytest.raises(IndexError) as err:
            virtool.nvstat.device_memory(5)

        assert "No device with index 5" in str(err)

    def test_no_smi(self, no_smi):
        """
        Test the a FileNotFound exception is raised is nvidia-smi is not available.

        """
        with pytest.raises(FileNotFoundError) as err:
            virtool.nvstat.device_memory(0)

        assert no_smi(err)

    def test_no_driver(self, no_driver):
        """
        Test the NVDriverError is raised the driver can't be found.

        """
        with pytest.raises(virtool.nvstat.NVDriverError) as err:
            virtool.nvstat.device_memory(0)

        assert no_driver(err)

    def test_process_error(self, nv_unhandled_error):
        """
        Test that unhandled ``CalledProcessErrors`` can still be raised.

        """
        with pytest.raises(subprocess.CalledProcessError) as err:
            virtool.nvstat.device_memory(0)


class TestDeviceClock:

    def test(self, mocker):
        """
        Test that the device clocks can be parsed from nvidia-smi when provided a valid device index.

        """
        return_value = bytes((
            "==============NVSMI LOG==============\n"
            "\n"
            "Timestamp                           : Wed Jun 28 11:29:56 2017\n"
            "Driver Version                      : 375.66\n"
            "\n"
            "Attached GPUs                       : 1\n"
            "GPU 0000:06:00.0\n"
            "    Clocks\n"
            "        Graphics                    : 1670 MHz\n"
            "        SM                          : 1670 MHz\n"
            "        Memory                      : 5005 MHz\n"
            "        Video                       : 1493 MHz\n"
            "    Applications Clocks\n"
            "        Graphics                    : N/A\n"
            "        Memory                      : N/A\n"
            "    Default Applications Clocks\n"
            "        Graphics                    : N/A\n"
            "        Memory                      : N/A\n"
            "    Max Clocks\n"
            "        Graphics                    : 1974 MHz\n"
            "        SM                          : 1974 MHz\n"
            "        Memory                      : 5005 MHz\n"
            "        Video                       : 1708 MHz\n"
            "    SM Clock Samples\n"
            "        Duration                    : 395.20 sec\n"
            "        Number of Samples           : 100\n"
            "        Max                         : 1670 MHz\n"
            "        Min                         : 202 MHz\n"
            "        Avg                         : 1484 MHz\n"
            "    Memory Clock Samples\n"
            "        Duration                    : 395.20 sec\n"
            "        Number of Samples           : 100\n"
            "        Max                         : 5005 MHz\n"
            "        Min                         : 405 MHz\n"
            "        Avg                         : 3643 MHz\n"
            "    Clock Policy\n"
            "        Auto Boost                  : N/A\n"
            "        Auto Boost Default          : N/A"
        ), encoding="utf-8")

        m = mocker.Mock(return_value=return_value)

        mocker.patch("subprocess.check_output", new=m)

        assert virtool.nvstat.device_clock(0) == {
            "base": {
                "graphics": 1670000000,
                "memory": 5005000000,
                "sm": 1670000000,
                "video": 1493000000
            },
            "max": {
                "graphics": 1974000000,
                "memory": 5005000000,
                "sm": 1974000000,
                "video": 1708000000
            }
        }

    def test_no_device(self, mocker):
        """
        Test that an IndexError is raised when the passed device index does not exist.

        """
        m = mocker.Mock(return_value="No devices were found")

        mocker.patch("subprocess.check_output", new=m)

        with pytest.raises(IndexError) as err:
            virtool.nvstat.device_clock(5)

        assert "No device with index 5" in str(err)

    def test_no_smi(self, no_smi):
        """
        Test the a FileNotFound exception is raised is nvidia-smi is not available.

        """
        with pytest.raises(FileNotFoundError) as err:
            virtool.nvstat.device_clock(0)

        assert no_smi(err)

    def test_no_driver(self, no_driver):
        """
        Test the NVDriverError is raised the driver can't be found.

        """
        with pytest.raises(virtool.nvstat.NVDriverError) as err:
            virtool.nvstat.device_clock(0)

        assert no_driver(err)

    def test_process_error(self, nv_unhandled_error):
        """
        Test that unhandled ``CalledProcessErrors`` can still be raised.

        """
        with pytest.raises(subprocess.CalledProcessError) as err:
            virtool.nvstat.device_clock(0)
