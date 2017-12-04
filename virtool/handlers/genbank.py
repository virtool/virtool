import re
import string
import aiohttp

from virtool.handlers.utils import json_response, not_found


async def get(req):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-style sequence
    document.

    """
    accession = req.match_info["accession"]

    tool = "Virtool"
    email = "igboyes@virtool.ca"

    params = {
        "db": "nucleotide",
        "term": "{}[accn]".format(accession),
        "tool": tool,
        "email": email
    }

    async with aiohttp.ClientSession() as session:
        async with session.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", params=params) as resp:
            data = await resp.text()
            gi = re.search("<Id>([0-9]+)</Id>", data).group(1)

        if gi:
            url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

            fetch_params = {
                "db": "nuccore",
                "id": gi,
                "rettype": "gb",
                "retmode": "text",
                "tool": tool,
                "email": email
            }

            async with session.get(url, params=fetch_params) as resp:
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

                return json_response(data)

    return not_found()
