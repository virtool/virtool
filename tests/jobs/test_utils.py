import pytest

import virtool.caches.db
import virtool.caches.utils
import virtool.jobs.utils
from virtool.http.rights import MODIFY, READ, REMOVE
from virtool.jobs.utils import JobRights, JobRightsDomain


@pytest.mark.parametrize("gzipped", [True, False])
@pytest.mark.parametrize("proc", [2, 4])
def test_copy_or_compress(gzipped, proc, mocker):
    path = "/mnt/baz/test.file"
    target = "/mnt/bar/foo.file"

    mocker.patch("virtool.utils.is_gzipped", return_value=gzipped)

    m_copyfile = mocker.patch("shutil.copyfile")

    m_compress_file = mocker.patch("virtool.utils.compress_file", return_value=gzipped)

    virtool.jobs.utils.copy_or_compress(path, target, proc)

    if not gzipped:
        m_compress_file.assert_called_with(path, target, processes=proc)
        m_copyfile.assert_not_called()
        return

    m_compress_file.assert_not_called()
    m_copyfile.assert_called_with(path, target)


async def test_get_sample_params(dbi):
    settings = {
        "data_path": "/mnt/hdd"
    }

    task_args = {
        "sample_id": "foo",
        "hello": "world"
    }

    files = [
        {"id": "abc1234-reads_a_1.fq.gz"},
        {"id": "hj1d821-reads_a_2.fq.gz"}
    ]

    document = {
        "_id": "foo",
        "files": files,
        "paired": True
    }

    await dbi.samples.insert_one(document)

    result = await virtool.jobs.utils.get_sample_params(dbi, settings, task_args)

    assert result == {
        "sample_id": "foo",
        "sample_path": "/mnt/hdd/samples/foo",
        "hello": "world",
        "document": document,
        "paired": True,
        "files": files
    }


async def test_job_rights_domain():
    domain = JobRightsDomain("dom")

    domain.can_read("foo", "bar", "baz")
    domain.can_read("baz")
    domain.can_modify("foo", "bar")
    domain.can_remove("foo")

    assert domain.has_right("foo", READ)
    assert domain.has_right("bar", READ)
    assert domain.has_right("baz", READ)
    assert domain.has_right("foo", MODIFY)
    assert domain.has_right("bar", MODIFY)
    assert domain.has_right("foo", REMOVE)

    assert not domain.has_right("baz", MODIFY)
    assert not domain.has_right("bar", REMOVE)
    assert not domain.has_right("baz", REMOVE)

    assert not domain.has_right("not", READ)
    assert not domain.has_right("not", MODIFY)
    assert not domain.has_right("not", REMOVE)

    assert domain.as_dict() == {
        "read": ["bar", "baz", "foo"],
        "modify": ["bar", "foo"],
        "remove": ["foo"]
    }


async def test_job_rights():
    """
    Ensure that all calls to methods on JobRights succeed given the input rights dictionary.

    """
    rights = JobRights({
        "analyses": {
            "read": ["foo", "bar", "baz"],
            "modify": ["baz"]
        },
        "samples": {
            "read": ["foo"]
        },
        "subtractions": {
            "read": ["bar"],
            "modify": ["bar"],
            "remove": ["bar"]
        },
        "uploads": {
            "read": ["foo", "baz"],
            "modify": ["foo", "baz"],
            "remove": ["foo", "baz"]
        },
        "references": {
            "read": ["foo"],
            "modify": ["foo"]
        }
    })

    assert rights.as_dict() == {
        "analyses": {
            "modify": ["baz"],
            "read": ["bar", "baz", "foo"]
        },
        "references": {
            "modify": ["foo"],
            "read": ["foo"]
        },
        "samples": {
            "read": ["foo"]
        },
        "subtractions": {
            "modify": ["bar"],
            "read": ["bar"],
            "remove": ["bar"]
        },
        "uploads": {
            "modify": ["baz", "foo"],
            "read": ["baz", "foo"],
            "remove": ["baz", "foo"]
        }
    }

    all_combos = {
        "analyses": [
            ("foo", READ),
            ("bar", READ),
            ("baz", READ),
            ("baz", "modify")
        ],
        "indexes": [],
        "samples": [("foo", READ)],
        "subtractions": [
            ("bar", READ),
            ("bar", MODIFY),
            ("bar", REMOVE)
        ],
        "uploads": [
            ("foo", READ),
            ("baz", READ),
            ("foo", MODIFY),
            ("baz", MODIFY),
            ("foo", REMOVE),
            ("baz", REMOVE)
        ],
        "references": [
            ("foo", READ),
            ("foo", MODIFY)
        ]
    }

    for name, combos in all_combos.items():
        for id_ in ("foo", "baz", "baz", "not"):
            for right in (READ, MODIFY, REMOVE):
                assert getattr(rights, name).has_right(id_, right) is ((id_, right) in combos)
