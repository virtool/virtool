import virtool.subtractions.utils


def test_join_subtraction_path():
    settings = {
        "data_path": "/foo"
    }

    path = virtool.subtractions.utils.join_subtraction_path(settings, "bar")

    assert path == "/foo/subtractions/bar"
