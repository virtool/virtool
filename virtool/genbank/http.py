"""
HTTP utilities for collecting data from GenBank on the API server.

"""
import io
import logging
from typing import Union, Optional

import Bio.SeqIO
import aiohttp

from virtool.configuration.config import Config
from virtool.http.proxy import ProxyRequest

logger = logging.getLogger(__name__)

EMAIL = "dev@virtool.ca"
TOOL = "virtool"

FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def fetch(config: Config, session: aiohttp.ClientSession, accession: Union[int, str]) -> Optional[dict]:
    """
    Fetch the Genbank record for the passed `accession`. Returns `None` if the Genbank record can not be found.

    :param config: the application configuration object
    :param session: an aiohttp client session
    :param accession: the accession to fetch
    :return: parsed Genbank data

    """
    params = {
        "db": "nuccore",
        "email": EMAIL,
        "id": accession,
        "retmode": "text",
        "rettype": "gb",
        "tool": TOOL
    }

    async with ProxyRequest(config, session.get, FETCH_URL, params=params) as resp:

        body = await resp.text()

        if resp.status != 200:
            if "Failed to retrieve sequence" not in body:
                logger.warning(f"Unexpected Genbank error: {body}")

            return None

        gb = Bio.SeqIO.read(io.StringIO(body), "gb")

        data = {
            "accession": gb.id,
            "definition": gb.description,
            "sequence": str(gb.seq),
            "host": ""
        }

        for feature in gb.features:
            if feature.type == "source":
                try:
                    data["host"] = feature.qualifiers["host"][0]
                except (IndexError, KeyError):
                    data["host"] = ""

        return data
