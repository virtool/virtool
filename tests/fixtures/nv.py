import pytest
import subprocess


@pytest.fixture
def no_smi(mocker):
    def raise_not_found_error(*args, **kwargs):
        raise FileNotFoundError

    mocker.patch("subprocess.check_output", new=raise_not_found_error)

    def func(err):
        return "nvidia-smi could not be called" in str(err)

    return func


@pytest.fixture
def no_driver(mocker):
    def raise_called_process_error(*args, **kwargs):
        output = bytes((
            "NVIDIA-SMI has failed because it couldn't communicate with NVIDIA driver. Make sure that latest NVIDIA "
            "driver is installed and running.\n\n"
        ), encoding="utf-8")

        raise subprocess.CalledProcessError(cmd=[], returncode=1, output=output)

    mocker.patch("subprocess.check_output", new=raise_called_process_error)

    def func(err):
        return "Couldn't communicate with NVIDIA driver" in str(err)

    return func


@pytest.fixture
def nv_unhandled_error(mocker):
    def raise_unhandled_error(*args, **kwargs):
        output = bytes((
            "This is an unhandled CalledProcessError"
        ), encoding="utf-8")

        raise subprocess.CalledProcessError(cmd=[], returncode=5, output=output)

    mocker.patch("subprocess.check_output", new=raise_unhandled_error)
