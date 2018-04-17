import virtool.db.history
import virtool.utils
import virtool.history


def test_calculate_diff(test_kind_edit):
    """
    Test that a diff is correctly calculated. Should work since the tested function is a very light wrapper for the
    dict differ function.

    """
    old, new = test_kind_edit

    diff = virtool.history.calculate_diff(old, new)

    assert diff.sort() == [
        ("change", "name", ("Prunus virus F", "Prunus virus E")),
        ("change", "abbreviation", ("PVF", "")), ("change", "version", (0, 1))
    ].sort()
