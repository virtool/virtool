import pytest

from virtool.data.errors import ResourceError
from virtool.tasks.registry import get_available_task_names, get_task_from_name


def test_all_task_types_are_registered():
    assert get_available_task_names() == [
        "sweep_blast",
        "evict_caches_lru",
        "install_hmms",
        "refresh_hmms",
        "create_index",
        "timeout_jobs",
        "clone_reference",
        "import_reference",
        "reap_orphaned_uploads",
    ]


def test_get_task_from_name():
    task_class = get_task_from_name("create_index")

    assert task_class.__name__ == "CreateIndexTask"
    assert task_class.__module__ == "virtool.indexes.tasks"


def test_get_task_from_name_rejects_unknown_name():
    with pytest.raises(ResourceError, match="Invalid task name"):
        get_task_from_name("unknown")
