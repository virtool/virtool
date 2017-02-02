import os
import gzip
import shutil
import pytest
import tarfile
import urllib.error
import virtool.gen
import virtool.updates

from .markers import slow

INSTALL_FILE_NAME = "virtool.tar.gz"
INSTALL_FILE_SIZE = 44282406

FAKE_CONTENT = "foobar-foobar-foobar-foobar-foobar-foobar-foobar-foobar"


@pytest.fixture(scope="function")
def install_file():
    return open(os.path.join("./virtool/tests/", INSTALL_FILE_NAME), "rb")


@pytest.fixture(scope="function")
def install_dir(tmpdir):
    shutil.copy(os.path.join("./virtool/tests/", INSTALL_FILE_NAME), str(tmpdir))
    return tmpdir


@pytest.fixture(scope="function")
def install_uncompressed(tmpdir):
    root_path = os.path.join(str(tmpdir), "virtool")

    os.mkdir(root_path)

    for filename in ["install.sh", "run", "VERSION"]:
        open(os.path.join(root_path, filename), "w").close()

    for dirname in ["client", "doc"]:
        os.mkdir(os.path.join(root_path, dirname))

    for filename in ["app.d879w8wa0kj0l2.js", "index.html", "favicon.ico"]:
        open(os.path.join(root_path, "client", filename), "w").close()

    for filename in ["doc.pdf", "doc.html"]:
        open(os.path.join(root_path, "doc", filename), "w").close()

    return tmpdir


class TestUrlFile:

    @pytest.mark.gen_test
    def test_get_url_file_good(self, monkeypatch, install_file):
        def mock_urlopen(url):
            return install_file

        monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

        url_file = yield virtool.updates.get_url_file("http://www.virtool.ca/test.tar.gz")

        assert len(url_file.read()) == INSTALL_FILE_SIZE

    @pytest.mark.gen_test
    def test_get_url_file_bad(self):
        with pytest.raises(urllib.error.HTTPError) as err:
            yield virtool.updates.get_url_file("http://www.virtool.ca/test.tar.gz")

        assert "Error 404" in str(err)

    @pytest.mark.gen_test
    def test_read_url_file(self, install_file):
        data = yield virtool.updates.read_url_file(install_file)
        assert len(data) == 4096


class TestDownloadRelease:

    @slow
    @pytest.mark.gen_test(timeout=30)
    def test_good_url(self, monkeypatch, install_file, tmpdir):

        def mock_urlopen(url):
            return install_file

        monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

        target_path = os.path.join(str(tmpdir), "v1.7.5.tar.gz")

        progress = list()

        @virtool.gen.coroutine
        def progress_handler(p):
            progress.append(p)

        yield virtool.updates.download_release(
            "http://www.virtool.ca/test.tar.gz",
            INSTALL_FILE_SIZE,
            target_path,
            progress_handler
        )

        assert progress[-1] == 1

        # Check that the file is the right size.
        assert os.path.getsize(target_path) == INSTALL_FILE_SIZE

    @pytest.mark.gen_test
    def test_bad_url(self, tmpdir):

        target_path = os.path.join(str(tmpdir), "v1.7.5.tar.gz")

        progress = list()

        with pytest.raises(urllib.error.HTTPError):
            yield virtool.updates.download_release(
                "http://www.virtool.ca/test.tar.gz",
                INSTALL_FILE_SIZE,
                target_path,
                lambda x: progress.append(x)
            )


class TestDecompressFile:

    @pytest.mark.gen_test
    def test_good_file(self, install_dir):
        tar_path = os.path.join(str(install_dir), INSTALL_FILE_NAME)

        yield virtool.updates.decompress_file(tar_path, str(install_dir))

        assert "virtool" in os.listdir(str(install_dir))

    @pytest.mark.gen_test
    def test_not_gzip_file(self, tmpdir):
        file_path = os.path.join(str(tmpdir), "test_file.tar.gz")

        with open(file_path, "w") as handle:
            handle.write(FAKE_CONTENT)

        with pytest.raises(tarfile.ReadError) as err:
            yield virtool.updates.decompress_file(file_path, str(tmpdir))

        assert "not a gzip file" in str(err)

    @pytest.mark.gen_test
    def test_not_tarball(self, tmpdir):
        file_path = os.path.join(str(tmpdir), "test_file.tar.gz")

        with gzip.open(file_path, "wt") as handle:
            handle.write(FAKE_CONTENT)

        with pytest.raises(tarfile.ReadError) as err:
            yield virtool.updates.decompress_file(file_path, str(tmpdir))

        assert "truncated header" in str(err)


class TestCheckSoftwareTree:

    @pytest.mark.gen_test
    def test_intact(self, install_uncompressed):
        intact = yield virtool.updates.check_software_tree(os.path.join(str(install_uncompressed), "virtool"))
        assert intact

    @pytest.mark.gen_test
    def test_missing_root_file(self, install_uncompressed):
        release_path = os.path.join(str(install_uncompressed), "virtool")
        os.remove(os.path.join(release_path, "run"))

        intact = yield virtool.updates.check_software_tree(release_path)

        assert not intact

    @pytest.mark.gen_test
    def test_missing_client_dir(self, install_uncompressed):
        release_path = os.path.join(str(install_uncompressed), "virtool")
        shutil.rmtree(os.path.join(release_path, "client"))

        intact = yield virtool.updates.check_software_tree(release_path)

        assert not intact

    @pytest.mark.gen_test
    def test_missing_doc_dir(self, install_uncompressed):
        release_path = os.path.join(str(install_uncompressed), "virtool")
        shutil.rmtree(os.path.join(release_path, "doc"))

        intact = yield virtool.updates.check_software_tree(release_path)

        assert not intact

    @pytest.mark.gen_test
    def test_missing_client_file(self, install_uncompressed):
        release_path = os.path.join(str(install_uncompressed), "virtool")
        os.remove(os.path.join(release_path, "client/index.html"))

        intact = yield virtool.updates.check_software_tree(release_path)

        assert not intact

    @pytest.mark.gen_test
    def test_missing_js_file(self, install_uncompressed):
        release_path = os.path.join(str(install_uncompressed), "virtool")
        client_path = os.path.join(release_path, "client")

        content = os.listdir(client_path)

        content.remove("favicon.ico")
        content.remove("index.html")

        os.remove(os.path.join(client_path, content[0]))

        intact = yield virtool.updates.check_software_tree(release_path)

        assert not intact


class TestCopySoftwareFiles:

    @pytest.mark.gen_test
    def test_valid(self, install_uncompressed):
        src = os.path.join(str(install_uncompressed), "virtool")
        dest = os.path.join(str(install_uncompressed), "install")

        yield virtool.updates.copy_software_files(src, dest)

        assert set(os.listdir(dest)) == {"client", "doc", "run", "VERSION"}
        assert set(os.listdir(os.path.join(dest, "client"))) == {"app.d879w8wa0kj0l2.js", "index.html", "favicon.ico"}
        assert set(os.listdir(os.path.join(dest, "doc"))) == {"doc.pdf", "doc.html"}
