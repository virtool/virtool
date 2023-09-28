"""
HTTP utilities for collecting data from GenBank on the API server.

"""
import io

import Bio.SeqIO
import aiohttp
from structlog import get_logger

logger = get_logger("genbank")

EMAIL = "dev@virtool.ca"
TOOL = "virtool"

FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def fetch(session: aiohttp.ClientSession, accession: int | str) -> dict | None:
    """
    Fetch the Genbank record for the passed `accession`. Returns `None` if the Genbank record can not be found.

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
        "tool": TOOL,
    }

    async with session.get(FETCH_URL, params=params) as resp:
        body = await resp.text()

        if resp.status != 200:
            if "Failed to retrieve sequence" not in body:
                logger.warning("Unexpected Genbank error", body=body)

            return None

        gb = Bio.SeqIO.read(io.StringIO(body), "gb")

        data = {
            "accession": gb.id,
            "definition": gb.description,
            "sequence": str(gb.seq),
            "host": "",
        }

        for feature in gb.features:
            if feature.type == "source":
                try:
                    data["host"] = feature.qualifiers["host"][0]
                except (IndexError, KeyError):
                    data["host"] = ""

        return data
