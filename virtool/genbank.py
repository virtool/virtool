import re
import string

import virtool.http.proxy

EMAIL = "dev@virtool.ca"
TOOL = "virtool"

FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
SEARCH_REGEX = re.compile("<Id>([0-9]+)</Id>")


async def fetch(settings, session, gi):
    """

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param session: an aiohttp client session
    :type session: :class:`aiohttp.ClientSession`

    :return: parsed Genbank data
    :rtype: dict

    """
    params = {
        "db": "nuccore",
        "email": EMAIL,
        "id": gi,
        "retmode": "text",
        "rettype": "gb",
        "tool": TOOL
    }

    async with virtool.http.proxy.ProxyRequest(settings, session.get, FETCH_URL, params=params) as resp:

        body = await resp.text()

        data = {
            "host": ""
        }

        for line in body.split("\n"):

            if line.startswith("VERSION"):
                data["accession"] = line.replace("VERSION", "").lstrip(" ")

            if line.startswith("DEFINITION"):
                data["definition"] = line.replace("DEFINITION", "").lstrip(" ")

            if "/host=" in line:
                data["host"] = line.lstrip(" ").replace("/host=", "").replace('"', "")

            # Extract sequence
            sequence_field = body.split("ORIGIN")[1].lower()

            for char in [" ", "/", "\n"] + list(string.digits):
                sequence_field = sequence_field.replace(char, "")

            data["sequence"] = sequence_field.upper()

        return data


async def search(settings, session, accession):
    """
    Search for and return the GI associated with a given Genbank accession. Returns `None` if no GI can be found for
    the `accession`.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param session: an aiohttp client session
    :type session: :class:`aiohttp.ClientSession`


    :param accession: the accession to find a GI for
    :type accession: str

    :return: a GI
    :rtype: Union[None, str]

    """
    params = {
        "db": "nucleotide",
        "term": "{}[accn]".format(accession),
        "tool": TOOL,
        "email": EMAIL
    }

    gi = None

    async with virtool.http.proxy.ProxyRequest(settings, session.get, SEARCH_URL, params=params) as resp:
        data = await resp.text()

        match = SEARCH_REGEX.search(data)

        if match:
            gi = match.group(1)

    return gi
