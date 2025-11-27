from pathlib import Path

from aiohttp import web
from aiohttp.test_utils import TestClient

from virtool.data.http import HTTPClient

FILE_SIZE = 114834


async def test_download_file(tmp_path: Path, aiohttp_client):
    """Test downloading a file using HTTPClient."""

    async def handler(request):
        return web.Response(body=b"x" * FILE_SIZE)

    app = web.Application()
    app.router.add_get("/file", handler)

    client: TestClient = await aiohttp_client(app)

    downloads_path = tmp_path / "downloads"
    downloads_path.mkdir()

    progress_values = []

    async def progress_handler(value: int):
        progress_values.append(value)

    http_client = HTTPClient(client.session)

    await http_client.download(
        f"{client.make_url('/file')}",
        downloads_path / "test_file.bin",
        progress_handler,
    )

    assert sum(progress_values) == FILE_SIZE
    assert (downloads_path / "test_file.bin").read_bytes() == b"x" * FILE_SIZE
