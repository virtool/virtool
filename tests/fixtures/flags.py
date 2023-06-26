import pytest

from virtool.flags import FlagName


@pytest.fixture
def enable_flags(*args: FlagName):
    """
    Enable provided feature flags for the duration of the test.
    """

    def func():
        for flag in args:
            FlagName[flag].value = True
