import structlog.testing

from virtool.workflow.runtime.run_subprocess import stderr_logger


def test_decodable_string():
    with structlog.testing.capture_logs() as logs:
        stderr_logger(b"Hello, world!")
    assert logs[0]["line"] == "Hello, world!"


async def test_non_decodable_string():
    with structlog.testing.capture_logs() as logs:
        stderr_logger(b"Hello, \xe2\x98")
    assert logs[0]["line"] == b"Hello, \xe2\x98"
