from pathlib import Path

from aiohttp import ClientSession

from virtool.data.http import HTTPClient


async def test_download_file(tmp_path: Path):
    """Test downloading a file using HTTPClient."""
    downloads_path = tmp_path / "downloads"
    downloads_path.mkdir()

    progress_values = []

    async def progress_handler(value: int):
        progress_values.append(value)

    async with ClientSession() as client_session:
        client = HTTPClient(client_session)

        await client.download(
            "https://www.w3.org/International/its/tests/test2.png",
            downloads_path / "license.txt",
            progress_handler,
        )

    assert sum(progress_values) == 114834
