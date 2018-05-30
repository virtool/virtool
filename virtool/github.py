import virtool.errors
import virtool.http.proxy

BASE_URL = "https://api.github.com/repos"

HEADERS = {
    "Accept": "application/vnd.github.v3+json"
}


def format_release(release):
    asset = release["assets"][0]

    return {
        "name": release["name"],
        "body": release["body"],
        "etag": release["etag"],
        "filename": asset["name"],
        "size": asset["size"],
        "browser_url": release["url"],
        "download_url": asset["browser_download_url"],
        "published_at": release["published_at"],
        "content_type": asset["content_type"]
    }


async def get_release(settings, session, slug, etag=None, version=None):
    """
    GET data from a GitHub API url.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param session: the application HTTP client session
    :type session: :class:`aiohttp.ClientSession`

    :param slug: the slug for the GitHub repo
    :type slug: str

    :param etag: an ETag for the resource to be used with the `If-None-Match` header
    :type etag: str

    :param version: the release name to get
    :type version: str

    :return: the latest release
    :rtype: Coroutine[dict]

    """
    specifier = "tags/" + version if version else "latest"

    url = "{}/{}/releases/{}".format(BASE_URL, slug, specifier)

    headers = dict(HEADERS)

    if etag:
        headers["If-None-Match"] = etag

    async with virtool.http.proxy.ProxyRequest(settings, session.get, url, headers=headers) as resp:
        if resp.status == 200:
            data = await resp.json()

            if len(data["assets"]) == 0:
                return None

            return dict(data, etag=resp.headers["etag"])

        elif resp.status == 304:
            return None

        else:
            raise virtool.errors.GitHubError("Encountered error {}".format(resp.status))
