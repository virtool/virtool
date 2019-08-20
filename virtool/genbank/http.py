import logging
import string

import virtool.http.proxy

logger = logging.getLogger(__name__)

EMAIL = "dev@virtool.ca"
TOOL = "virtool"

FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def fetch(settings, session, accession):
    """
    Fetch the Genbank record for the passed `accession`.

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param session: an aiohttp client session
    :type session: :class:`aiohttp.ClientSession`

    :param accession: the accession to fetch
    :type accession: Union[int,str]

    :return: parsed Genbank data
    :rtype: dict

    """
    params = {
        "db": "nuccore",
        "email": EMAIL,
        "id": accession,
        "retmode": "text",
        "rettype": "gb",
        "tool": TOOL
    }

    async with virtool.http.proxy.ProxyRequest(settings, session.get, FETCH_URL, params=params) as resp:

        body = await resp.text()

        if resp.status != 200:
            if "Failed to retrieve sequence" not in body:
                logger.warning(f"Unexpected Genbank error: {body}")

            return None

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
