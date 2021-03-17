from virtool.dispatcher.change import Change
from virtool.dispatcher.operations import UPDATE


def test_change():
    """
    Make sure a change object has the required attributes and string representation.

    """
    change = Change(
        "jobs",
        UPDATE,
        ["foo", "bar"]
    )

    assert change.interface == "jobs"
    assert change.operation == UPDATE
    assert change.id_list == ["foo", "bar"]

    assert str(change) == (
        '<Change interface="jobs" operation="update" id_list="[\'foo\', \'bar\']">'
    )

    assert change.target == "jobs.update"
