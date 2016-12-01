import os
import pytest
import virtool.utils

from virtool.testing.fixtures import static_time


@pytest.fixture
def fake_dir(tmpdir):
    file_1 = tmpdir.join("hello.txt")
    file_2 = tmpdir.join("world.txt")

    file_1.write("hello world")
    file_2.write("this is a test file")

    return tmpdir


@pytest.fixture(scope="session")
def alphanumeric():
    return "abcdefghijklmnopqrstuvwxyz1234567890"


@pytest.fixture(scope="function")
def randomizer():
    source = [
        "abc123",
        "jkl932",
        "90r2ja",
        "87e9wa",
        "skk342",
        "skl1qq"
    ]

    def function():
        return source.pop()

    return function


@pytest.fixture(scope="function")
def collection():
    return [
        {
            "id": 0,
            "name": "lambert"
        },
        {
            "id": 1,
            "name": "winston"
        },
        {
            "id": 2,
            "name": "stuart"
        },
    ]


class TestRm:

    @pytest.mark.gen_test
    def test_rm_file(self, fake_dir):
        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt"}

        path = os.path.join(str(fake_dir), "world.txt")

        yield virtool.utils.rm(path)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt"}

    @pytest.mark.gen_test
    def test_rm_folder(self, fake_dir):
        fake_dir.mkdir("dummy")

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy"}

        path = os.path.join(str(fake_dir), "dummy")

        with pytest.raises(IsADirectoryError):
            yield virtool.utils.rm(path)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy"}

    @pytest.mark.gen_test
    def test_rm_folder_recursive(self, fake_dir):
        fake_dir.mkdir("dummy_recursive")

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt", "dummy_recursive"}

        path = os.path.join(str(fake_dir), "dummy_recursive")

        yield virtool.utils.rm(path, recursive=True)

        assert set(os.listdir(str(fake_dir))) == {"hello.txt", "world.txt"}


class TestWriteFile:

    @pytest.mark.gen_test
    def test_utf(self, fake_dir):
        path = os.path.join(str(fake_dir), "utf.txt")

        yield virtool.utils.write_file(path, "utf8-encoded content", is_bytes=False)

        with open(path, "r") as handle:
            assert handle.read() == "utf8-encoded content"

    @pytest.mark.gen_test
    def test_utf_exception(self, fake_dir):
        path = os.path.join(str(fake_dir), "utf.txt")

        with pytest.raises(TypeError):
            yield virtool.utils.write_file(path, "utf8-encoded content", is_bytes=True)

    @pytest.mark.gen_test
    def test_bytes(self, fake_dir):
        path = os.path.join(str(fake_dir), "bytes.dat")

        b = "bytes content".encode("utf-8")

        yield virtool.utils.write_file(path, b, is_bytes=True)

        with open(path, "r") as handle:
            assert handle.read() == "bytes content"

    @pytest.mark.gen_test
    def test_bytes_exception(self, fake_dir):
        path = os.path.join(str(fake_dir), "bytes.dat")

        b = "bytes content".encode("utf-8")

        with pytest.raises(TypeError):
            yield virtool.utils.write_file(path, b, is_bytes=False)


class TestListFiles:

    @pytest.mark.gen_test
    def test_valid_path(self, fake_dir):
        file_list = yield virtool.utils.list_files(str(fake_dir))

        assert {"hello.txt", "world.txt"} == set(file_list.keys())

        assert file_list["hello.txt"]["size"] < file_list["world.txt"]["size"]

        for file_dict in file_list.values():
            assert "_id" in file_dict
            assert "size" in file_dict
            assert "access" in file_dict
            assert "modify" in file_dict
            assert file_dict["access"]
            assert file_dict["modify"]

    @pytest.mark.gen_test
    def test_invalid_path(self, fake_dir):
        assert "invalid_dir" not in os.listdir(str(fake_dir))

        invalid_path = os.path.join(str(fake_dir), "invalid_dir")

        with pytest.raises(FileNotFoundError):
            yield virtool.utils.list_files(invalid_path)

    @pytest.mark.gen_test
    def test_excluded(self, fake_dir):
        file_list = yield virtool.utils.list_files(str(fake_dir), excluded=["world.txt"])
        assert "world.txt" not in file_list.keys()


class TestTimeStamp:

    def test_time_getter(self, static_time):
        result = virtool.utils.timestamp(time_getter=lambda: static_time)
        assert result == "2000-01-01T00:00:00"

    def test_datetime(self, static_time):
        result = virtool.utils.timestamp(static_time)
        assert result == "2000-01-01T00:00:00"

    def test_posix(self):
        result = virtool.utils.timestamp(1480549990.4495726)
        assert result == "2016-11-30T15:53:10.449573"

    def test_invalid_time(self):
        with pytest.raises(TypeError):
            virtool.utils.timestamp("a")


class TestRandomAlphanumeric:

    @pytest.mark.gen_test
    def test_default(self, alphanumeric):
        for i in range(0, 10):
            an = virtool.utils.random_alphanumeric()
            assert len(an) == 6
            assert all([l in alphanumeric for l in an])

    @pytest.mark.gen_test
    def test_length(self, alphanumeric):
        for length in [7, 10, 25, 12, 4, 22, 17, 30, 8, 14, 19]:
            an = virtool.utils.random_alphanumeric(length)
            assert len(an) == length
            assert all([l in alphanumeric for l in an])

    @pytest.mark.gen_test
    def test_randomizer(self, alphanumeric, randomizer):
        results = set()

        for i in range(0, 6):
            an = virtool.utils.random_alphanumeric(randomizer=randomizer)
            assert len(an) == 6
            assert all([l in alphanumeric for l in an])
            results.add(an)

        assert results == {"abc123", "jkl932", "90r2ja", "87e9wa", "skk342", "skl1qq"}

    @pytest.mark.gen_test
    def test_excluded(self, alphanumeric, randomizer):
        for i in range(0, 5):
            an = virtool.utils.random_alphanumeric(excluded=["87e9wa"], randomizer=randomizer)
            assert an != "87e9wa"
            assert len(an) == 6
            assert all([l in alphanumeric for l in an])


class TestWhere:

    def test_default(self, collection):
        result = virtool.utils.where(collection, {"id": 2})
        assert result["name"] == "stuart"

        result = virtool.utils.where(collection, {"name": "winston"})
        assert result["id"] == 1

        result = virtool.utils.where(collection, {"type": "bear"})
        assert result is None

    def test_nonexistent_property(self, collection):
        result = virtool.utils.where(collection, {"type": "bear"})
        assert result is None

    def test_double_predicate(self, collection):
        result = virtool.utils.where(collection, {"name": "lambert", "id": 0})
        assert result == {"name": "lambert", "id": 0}

    def test_invalid_double_predicate(self, collection):
        result = virtool.utils.where(collection, {"name": "winston", "type": "horse"})
        assert result is None

    def test_lambda_predicate(self, collection):
        result = virtool.utils.where(collection, lambda x: "wins" in x["name"])
        assert result == {"name": "winston", "id": 1}

    def test_function_predicate(self, collection):
        def predicate(entry):
            return entry["id"] + 5 == 7

        result = virtool.utils.where(collection, predicate)

        assert result["name"] == "stuart"

    def test_wrong_type(self, collection):
        with pytest.raises(TypeError):
            virtool.utils.where(collection, "test")


class TestAverageList:

    def test_default(self):
        list1 = [2, 5, 6, 10, 14, 20]
        list2 = [-1, 3, 0, 22, 12, 11]

        expected = [0.5, 4, 3, 16, 13, 15.5]

        assert virtool.utils.average_list(list1, list2) == expected

    def test_mismatched(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([1, 3, 2, 4], [2, 3, 7])

    def test_wrong_item_type(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([2, 5, 6], [8, "a", 5])

    def test_wrong_arg_type(self):
        with pytest.raises(TypeError):
            virtool.utils.average_list([2, 5, 6], "a")
