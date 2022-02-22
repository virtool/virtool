import io
import json
import re
from logging import getLogger
from typing import Tuple
from zipfile import ZipFile

import aiohttp

import virtool.errors
from virtool.config.cls import Config
from virtool.http.proxy import ProxyRequest

logger = getLogger("blast")

#: The URL to send BLAST requests to.
BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi"


def extract_blast_info(html: str) -> Tuple[str, int]:
    """
    Extract the RID and RTOE from BLAST HTML data containing a <QBlastInfo /> tag.

    :param html: the input HTML
    :return: a tuple containing the RID and RTOE

    """
    string = html.split("<!--QBlastInfoBegin")[1].split("QBlastInfoEnd")[0]

    match = re.search(r"RID = (.+)", string)
    rid = match.group(1)

    match = re.search(r"RTOE = (.+)", string)
    rtoe = match.group(1)

    return rid, int(rtoe)


def extract_blast_zip(data, rid: str) -> dict:
    """
    Extract the BLAST result JSON data given zipped binary data.

    Fails if the data is not valid zip.

    :param data: the binary zip data
    :param rid: the RID for the blast request
    :return: the extracted BLAST JSON data

    """
    zipped = ZipFile(io.BytesIO(data))
    string = zipped.open(rid + "_1.json", "r").read().decode()
    return json.loads(string)


def format_blast_content(result: dict) -> dict:
    """
    Format the BLAST result data from NCBI into a format easily usable by Virtool.

    :param result: the raw BLAST result
    :return: the formatted BLAST result

    """
    if len(result) != 1:
        raise virtool.errors.NCBIError(
            f"Unexpected BLAST result count {len(result)} returned"
        )

    result = result["BlastOutput2"]

    if len(result) != 1:
        raise virtool.errors.NCBIError(
            f"Unexpected BLAST result count {len(result)} returned"
        )

    result = result["report"]

    output = {key: result[key] for key in ["program", "params", "version"]}

    output["target"] = result["search_target"]

    result = result["results"]["search"]

    return {
        **output,
        "hits": [format_blast_hit(h) for h in result["hits"]],
        "stat": result["stat"],
        "masking": result.get("query_masking"),
    }


def format_blast_hit(hit: dict) -> dict:
    """
    Format a BLAST hit from NCBI into a format more usable by Virtool.

    :param hit: the BLAST hit
    :return: the formatted hit

    """
    cleaned = {
        key: hit["description"][0].get(key, "")
        for key in ["accession", "taxid", "title"]
    }

    hsps = {
        key: hit["hsps"][0][key]
        for key in ["identity", "evalue", "align_len", "score", "bit_score", "gaps"]
    }

    return {
        **cleaned,
        **hsps,
        "name": hit["description"][0].get("sciname", "No name"),
        "len": hit["len"],
    }


async def check_rid(config: Config, rid: str) -> bool:
    """
    Check if the BLAST process identified by the passed RID is ready.

    :param rid: the RID to check
    :param config: the application configuration object
    :return: ``True`` if ready, ``False`` otherwise

    """
    params = {"CMD": "Get", "RID": rid, "FORMAT_OBJECT": "SearchInfo"}

    async with aiohttp.ClientSession() as session, ProxyRequest(
        config, session.get, BLAST_URL, params=params
    ) as resp:
        if resp.status != 200:
            raise virtool.errors.NCBIError(
                f"RID check request returned status {resp.status}"
            )

        return "Status=WAITING" not in await resp.text()


async def initialize_ncbi_blast(config: Config, sequence: str) -> Tuple[str, int]:
    """
    Send a request to NCBI to BLAST the passed sequence.

    Return the RID and RTOE from the response.

    :param config: the application configuration object
    :param sequence: the nucleotide sequence to BLAST
    :return: the RID and RTOE for the request
    """
    # Parameters passed in the URL string. eg. ?CMD=Put&DATABASE=nr
    params = {
        "CMD": "Put",
        "DATABASE": "nr",
        "PROGRAM": "blastn",
        "MEGABLAST": "on",
        "HITLIST_SIZE": 5,
        "FILTER": "mL",
        "FORMAT_TYPE": "JSON2",
    }

    # Data passed as POST content.
    data = {"QUERY": sequence}

    async with aiohttp.ClientSession() as session, ProxyRequest(
        config, session.post, BLAST_URL, params=params, data=data
    ) as resp:
        if resp.status != 200:
            raise virtool.errors.NCBIError(
                f"BLAST request returned status: {resp.status}"
            )

        # Extract and return the RID and RTOE from the QBlastInfo tag.
        html = await resp.text()

        logger.debug("Started BLAST on NCBI")

        return extract_blast_info(html)


async def get_ncbi_blast_result(
    config: Config, run_in_process: callable, rid: str
) -> dict:
    """
    Retrieve the BLAST result with the given `rid` from NCBI.

    :param config: the application configuration
    :param run_in_process: the application processing running function
    :param rid: the rid to retrieve a result for
    :return: the BLAST result

    """
    params = {
        "CMD": "Get",
        "RID": rid,
        "FORMAT_TYPE": "JSON2",
        "FORMAT_OBJECT": "Alignment",
    }

    async with aiohttp.ClientSession() as session, ProxyRequest(
        config, session.get, BLAST_URL, params=params
    ) as resp:
        data = await resp.read()
        return await run_in_process(extract_blast_zip, data, rid)
