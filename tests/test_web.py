import os
import pytest
import subprocess

from virtool.app import find_server_version


@pytest.fixture
def bad_check_output():
    def check_output(*args, **kwargs):
        raise subprocess.CalledProcessError(1, "none")

    return check_output


@pytest.fixture
def fixed_git_describe():
    def check_output(*args, **kwargs):
        return bytes("1.0.13", encoding="utf-8")

    return check_output


class TestFindServerVersion:

    def test_git(self, monkeypatch, fixed_git_describe, tmpdir):
        monkeypatch.setattr(subprocess, "check_output", fixed_git_describe)

        version = find_server_version(str(tmpdir))

        assert version == "1.0.13"

    def test_file(self, monkeypatch, bad_check_output, tmpdir):
        tmpdir.join("VERSION")

        with open(os.path.join(str(tmpdir), "VERSION"), "w") as handle:
            handle.write("1.0.12")

        monkeypatch.setattr(subprocess, "check_output", bad_check_output)

        version = find_server_version(str(tmpdir))

        assert version == "1.0.12"

    def test_none(self, monkeypatch, bad_check_output, tmpdir):

        monkeypatch.setattr(subprocess, "check_output", bad_check_output)

        version = find_server_version(str(tmpdir))

        assert version == "Unknown"
