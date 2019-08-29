import pytest
import virtool.github


@pytest.fixture
def fake_release():
    class Release:
        raw = {
            "id": 0,
            "name": "v3.2.1",
            "body": "body",
            "etag": "etag",
            "published_at": "2019-07-23T21:10:17Z",
            "html_url": "https://www.example.com/release",
            "assets": [
                {
                    "name": "virtool.tar.gz",
                    "content_type": "application/gzip",
                    "size": 32203112,
                    "browser_download_url": "https://www.example.com/file"

                }
            ]
        }

        formatted = {
            "id": 0,
            "body": "body",
            "content_type": "application/gzip",
            "download_url": "https://www.example.com/file",
            "etag": "etag",
            "filename": "virtool.tar.gz",
            "html_url": "https://www.example.com/release",
            "name": "v3.2.1",
            "published_at": "2019-07-23T21:10:17Z",
            "size": 32203112
        }

    return Release()


def test_format_release(fake_release):
    result = virtool.github.format_release(fake_release.raw)
    assert result == fake_release.formatted


@pytest.mark.parametrize("release", [None, {"etag": "foobar"}, {"hello": "world"}])
def test_get_etag(release):
    result = virtool.github.get_etag(release)

    if release and "etag" in release:
        assert result == "foobar"
        return

    assert result is None
