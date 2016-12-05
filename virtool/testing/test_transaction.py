import pytest

from virtool.testing.fixtures import called_tester


class TestReload:

    def test_attr(self, called_tester):
        reload = called_tester()
        shutdown = called_tester()
        add_periodic_callback = called_tester()

        reload("thing")