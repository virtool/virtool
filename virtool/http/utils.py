import aiofiles

import virtool.errors
import virtool.http.proxy


async def download_file(app, url, target_path, progress_handler=None):
    """
    Download the GitHub release at ``url`` to the location specified by ``target_path``.

    :param app: the app object
    :type app: :class:`aiohttp.web.Application`

    :param url: the download URL for the release
    :type url str

    :param target_path: the path to write the downloaded file to.
    :type target_path: str

    :param progress_handler: a callable that will be called with the current progress when it changes.
    :type progress_handler: Callable[[Union[float, int]]]

    """
    async with virtool.http.proxy.ProxyRequest(app["settings"], app["client"].get, url) as resp:
        if resp.status != 200:
            return None

        async with aiofiles.open(target_path, "wb") as handle:
            while True:
                chunk = await resp.content.read(4096)

                if not chunk:
                    break

                await handle.write(chunk)

                if progress_handler:
                    await progress_handler(len(chunk))
