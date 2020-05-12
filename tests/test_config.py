import pytest
import virtool.config
import virtool.utils


def test_schema(snapshot):
    """
    Check that schema has not changed.

    """
    snapshot.assert_match(virtool.config.SCHEMA)


def test_get_defaults(mocker):
    mocker.patch("virtool.config.SCHEMA", {
        "foo": {
            "type": "integer",
            "default": 2
        },
        "bar": {
            "type": "string",
            "default": "hello"
        }
    })

    assert virtool.config.get_defaults() == {
        "foo": 2,
        "bar": "hello"
    }


def test_remove_defaults(mocker):
    defaults = {
        "proc": 24,
        "mem": 48
    }

    mocker.patch("virtool.config.get_defaults", return_value=defaults)

    config = {
        "proc": 24,
        "mem": 24
    }

    virtool.config.remove_defaults(config)

    assert config == {
        "mem": 24
    }
