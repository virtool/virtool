import asyncio
import datetime
import os
import shutil
from pathlib import Path

import arrow
import pytest

import virtool.utils
from virtool.api.errors import APIBadRequest
from virtool.data.errors import ResourceConflictError
from virtool.models import BaseModel
from virtool.samples.models import Sample
from virtool.utils import (
    coerce_to_coroutine_function,
    decompress_tgz,
    get_model_by_name,
    is_within_directory,
    make_directory,
    wait_for_checks,
)


@pytest.fixture(scope="session")
def alphanumeric():
    return "abcdefghijklmnopqrstuvwxyz1234567890"


@pytest.mark.parametrize(
    "document,result",
    [(None, None), ({"_id": "foo"}, {"id": "foo"}), ({"id": "foo"}, {"id": "foo"})],
)
def test_base_processor(document, result):
    assert virtool.utils.base_processor(document) == result


class TestCoerceToCoroutineFunction:
    """Tests for coerce_to_coroutine_function."""

    def test_returns_async_function_unchanged(self):
        """Test that async functions are returned as-is."""

        async def async_func():
            return "async"

        result = coerce_to_coroutine_function(async_func)
        assert result is async_func

    def test_wraps_sync_function(self):
        """Test that sync functions are wrapped in async."""

        def sync_func():
            return "sync"

        result = coerce_to_coroutine_function(sync_func)
        assert result is not sync_func
        assert callable(result)

    async def test_wrapped_function_works(self):
        """Test that wrapped sync function works correctly."""

        def sync_func(x, y=10):
            return x + y

        async_func = coerce_to_coroutine_function(sync_func)
        result = await async_func(5, y=15)
        assert result == 20


def test_decompress_tgz(example_path: Path, tmp_path: Path):
    """Test the decompress_tgz successfully decompresses and unpacks a tar."""
    shutil.copy(example_path / "ml" / "model.tar.gz", tmp_path)

    decompress_tgz(tmp_path / "model.tar.gz", tmp_path / "de")

    assert {p.name for p in tmp_path.iterdir()} == {"model.tar.gz", "de"}

    assert {p.name for p in (tmp_path / "de").iterdir()} == {"model"}

    assert {p.name for p in (tmp_path / "de" / "model").iterdir()} == {
        "mappability_profile.rds",
        "nucleotide_info.csv",
        "reference.json.gz",
        "trained_rf.rds",
        "trained_xgb.rds",
        "virus_segments.rds",
    }


def test_generate_key(mocker):
    """Test that API keys are generated using UUID4 and that :func:`generate_api_key()` returns the
    raw and hashed version of the key. Hashing is done through a call to :func:`hash_api_key`.

    """
    m_token_hex = mocker.patch("secrets.token_hex", return_value="foobar")
    assert virtool.utils.generate_key() == (
        "foobar",
        "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
    )
    m_token_hex.assert_called_with(32)


def test_get_model_by_name():
    subclasses = []

    for cls in BaseModel.__subclasses__():
        subclasses.append(cls)

    assert get_model_by_name("Sample") == Sample


class TestRandomAlphanumeric:
    def test_default(self, alphanumeric):
        for _ in range(10):
            result = virtool.utils.random_alphanumeric()
            assert len(result) == 6
            assert all(a in alphanumeric for a in result)

    def test_length(self, alphanumeric):
        for length in [7, 10, 25, 12, 4, 22, 17, 30, 8, 14, 19]:
            result = virtool.utils.random_alphanumeric(length)
            assert len(result) == length
            assert all(a in alphanumeric for a in result)

    def test_excluded(self, alphanumeric):
        for _ in range(5):
            result = virtool.utils.random_alphanumeric(excluded=["87e9wa"])
            assert result != "87e9wa"
            assert len(result) == 6
            assert all(a in alphanumeric for a in result)


def test_timestamp(mocker):
    """Test that the timestamp util returns a datetime object with the last 3 digits of the
    microsecond frame set to zero.

    """
    m = mocker.Mock(return_value=arrow.Arrow(2017, 10, 6, 20, 0, 0, 612304))

    mocker.patch("arrow.utcnow", new=m)

    timestamp = virtool.utils.timestamp()

    assert isinstance(timestamp, datetime.datetime)

    assert timestamp == arrow.arrow.Arrow(2017, 10, 6, 20, 0, 0, 612304).naive


@pytest.mark.parametrize(
    "value,result", [("true", True), ("1", True), ("false", False), ("0", False)]
)
def test_to_bool(value, result):
    """Test that function converts expected input values correctly."""
    assert virtool.utils.to_bool(value) == result


@pytest.mark.parametrize("exception", [None, "ResourceConflictErr", "TypeError"])
async def test_wait_for_checks(exception):
    async def check_one():
        _ = 1
        await asyncio.sleep(0.5)

    async def check_two():
        _ = 2
        await asyncio.sleep(1)
        raise ResourceConflictError("Exception thrown for test function check_two")

    async def check_three():
        _ = 3
        await asyncio.sleep(0.5)
        raise APIBadRequest("Exception thrown for test function check_three")

    async def check_four():
        _ = 4
        await asyncio.sleep(0.25)
        return 4

    if exception == "ResourceConflictErr":
        with pytest.raises(ResourceConflictError) as err:
            await wait_for_checks(check_one(), check_two(), check_three(), check_four())
        assert "check_two" in str(err)
        return

    if exception == "TypeError":
        with pytest.raises(TypeError) as err:
            await wait_for_checks(check_one(), check_four(), check_two())
        assert "Check functions may only return a NoneType object" in str(err)
        return

    assert await wait_for_checks(check_one()) is None


class TestIsWithinDirectory:
    def test_ok(self, tmp_path: Path):
        """Test that a path within a directory returns True."""
        directory = tmp_path / "base"
        directory.mkdir()
        target = directory / "subdir" / "file.txt"

        assert is_within_directory(directory, target) is True

    def test_same_directory(self, tmp_path: Path):
        """Test that the same directory returns True."""
        directory = tmp_path / "base"
        directory.mkdir()

        assert is_within_directory(directory, directory) is True

    def test_outside_directory(self, tmp_path: Path):
        """Test that a path outside the directory returns False."""
        directory = tmp_path / "base"
        directory.mkdir()
        outside = tmp_path / "other" / "file.txt"

        assert is_within_directory(directory, outside) is False

    def test_parent_directory(self, tmp_path: Path):
        """Test that a parent directory returns False."""
        directory = tmp_path / "base" / "subdir"
        directory.mkdir(parents=True)
        parent = tmp_path / "base"

        assert is_within_directory(directory, parent) is False

    def test_path_traversal_attack(self, tmp_path: Path):
        """Test that directory traversal attempts return False."""
        directory = tmp_path / "base"
        directory.mkdir()

        # Simulate a path traversal attack
        malicious_path = directory / ".." / ".." / "etc" / "passwd"

        assert is_within_directory(directory, malicious_path) is False

    def test_relative_paths(self, tmp_path: Path):
        """Test with relative paths."""
        # Create a subdirectory structure
        base_dir = tmp_path / "project"
        base_dir.mkdir()
        sub_dir = base_dir / "src"
        sub_dir.mkdir()

        # Change to the tmp directory and use relative paths
        original_cwd = Path.cwd()
        try:
            os.chdir(tmp_path)

            # Test relative directory and target
            assert (
                is_within_directory(Path("project"), Path("project/src/file.py"))
                is True
            )
            assert is_within_directory(Path("project"), Path("other/file.py")) is False

        finally:
            os.chdir(original_cwd)

    def test_symlink_paths(self, tmp_path: Path):
        """Test behavior with symlink paths."""
        directory = tmp_path / "base"
        directory.mkdir()
        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()

        # Create a symlink that points outside the directory
        symlink_path = directory / "symlink"
        symlink_path.symlink_to(outside_dir)

        assert is_within_directory(directory, symlink_path / "file.txt") is False

    def test_deeply_nested_paths(self, tmp_path: Path):
        """Test with deeply nested directory structures."""
        directory = tmp_path / "base"
        directory.mkdir()

        # Create a deeply nested path
        nested_path = directory / "a" / "b" / "c" / "d" / "e" / "f" / "file.txt"

        assert is_within_directory(directory, nested_path) is True

    def test_nonexistent_paths(self, tmp_path: Path):
        """Test with non-existent paths."""
        directory = tmp_path / "base"
        directory.mkdir()

        # Test with non-existent target within directory
        target = directory / "nonexistent" / "file.txt"
        assert is_within_directory(directory, target) is True

        # Test with non-existent target outside directory
        outside_target = tmp_path / "nonexistent" / "file.txt"
        assert is_within_directory(directory, outside_target) is False


class TestMakeDirectory:
    async def test_make_directory(self, tmp_path: Path):
        """Test that the simple case works."""
        path = tmp_path / "base"

        assert path.is_dir() is False

        await make_directory(path)

        assert path.is_dir() is True

    async def test_exists(self, tmp_path: Path):
        """Test that created a directory that already exists works."""
        path = tmp_path / "base"
        path.mkdir()

        assert path.is_dir() is True

        await make_directory(path)

        assert path.is_dir() is True

    async def test_with_parent(self, tmp_path: Path):
        """Test that a parent directory is created automatically."""
        base_path = tmp_path / "base"
        next_path = base_path / "next"

        assert base_path.is_dir() is False
        assert next_path.is_dir() is False

        await make_directory(next_path)

        assert base_path.is_dir() is True
        assert next_path.is_dir() is True


class TestRm:
    def test_remove_file(self, tmp_path: Path):
        """Test removing a simple file."""
        file_path = tmp_path / "test.txt"
        file_path.write_text("test content")

        assert file_path.exists()
        assert virtool.utils.rm(file_path) is True
        assert not file_path.exists()

    def test_remove_empty_directory_recursive(self, tmp_path: Path):
        """Test removing an empty directory with recursive=True."""
        dir_path = tmp_path / "empty_dir"
        dir_path.mkdir()

        assert dir_path.exists()
        assert virtool.utils.rm(dir_path, recursive=True) is True
        assert not dir_path.exists()

    def test_remove_non_empty_directory_recursive(self, tmp_path: Path):
        """Test removing a non-empty directory with recursive=True."""
        dir_path = tmp_path / "non_empty_dir"
        dir_path.mkdir()
        (dir_path / "file1.txt").write_text("content 1")
        (dir_path / "file2.txt").write_text("content 2")
        subdir = dir_path / "subdir"
        subdir.mkdir()
        (subdir / "file3.txt").write_text("content 3")

        assert dir_path.exists()
        assert virtool.utils.rm(dir_path, recursive=True) is True
        assert not dir_path.exists()

    def test_remove_directory_without_recursive_raises(self, tmp_path: Path):
        """Test that removing a directory without recursive=True raises IsADirectoryError."""
        dir_path = tmp_path / "dir"
        dir_path.mkdir()

        with pytest.raises(IsADirectoryError):
            virtool.utils.rm(dir_path, recursive=False)
