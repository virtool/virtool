import virtool.setup.setup


def test_setup_schema(setup_defaults):
    """
    Check the `get_defaults()` returns expected default setup `dict`.

    """
    assert virtool.setup.setup.get_defaults() == setup_defaults
