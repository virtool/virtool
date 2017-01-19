import pytest

slow = pytest.mark.skipif(pytest.config.getoption("--quick"), reason="Slow test. Runs when --quick is not set.")
