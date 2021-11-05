import asyncio
import io
import json
import logging
import re
import zipfile

import aiohttp

import virtool.analyses.db
import virtool.errors
import virtool.utils
from virtool.http.proxy import ProxyRequest

logger = logging.getLogger(__name__)

BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi"


async def initialize_ncbi_blast(config, sequence: dict) -> tuple:
    """
    Send a request to NCBI to BLAST the passed sequence. Return the RID and RTOE from the response.

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
        "FORMAT_TYPE": "JSON2"
    }

    # Data passed as POST content.
    data = {
        "QUERY": sequence
    }

    async with aiohttp.ClientSession() as session:
        async with ProxyRequest(config, session.post, BLAST_URL, params=params, data=data) as resp:
            if resp.status != 200:
                raise virtool.errors.NCBIError(f"BLAST request returned status: {resp.status}")

            # Extract and return the RID and RTOE from the QBlastInfo tag.
            html = await resp.text()

            logging.debug("Started BLAST on NCBI")

            return extract_blast_info(html)


def extract_blast_info(html: str) -> tuple:
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


async def check_rid(config, rid: str) -> bool:
    """
    Check if the BLAST process identified by the passed RID is ready.

    :param rid: the RID to check
    :param config: the application configuration object
    :return: ``True`` if ready, ``False`` otherwise

    """
    params = {
        "CMD": "Get",
        "RID": rid,
        "FORMAT_OBJECT": "SearchInfo"
    }

    async with aiohttp.ClientSession() as session:
        async with ProxyRequest(config, session.get, BLAST_URL, params=params) as resp:
            if resp.status != 200:
                raise virtool.errors.NCBIError(f"RID check request returned status {resp.status}")

            return "Status=WAITING" not in await resp.text()


def extract_ncbi_blast_zip(data, rid: str) -> dict:
    """
    Extract the BLAST result JSON data given zipped binary data. Fails if the data is not valid zip.

    :param data: the binary zip data
    :param rid: the RID for the blast request
    :return: the extracted BLAST JSON data

    """
    zipped = zipfile.ZipFile(io.BytesIO(data))
    string = zipped.open(rid + "_1.json", "r").read().decode()
    return json.loads(string)


def format_blast_hit(hit: dict) -> dict:
    """
    Format a BLAST hit from NCBI into a format more usable by Virtool.

    :param hit: the BLAST hit
    :return: the formatted hit

    """
    cleaned = {key: hit["description"][0].get(key, "") for key in ["accession", "taxid", "title"]}

    hsps = {key: hit["hsps"][0][key] for key in [
        "identity",
        "evalue",
        "align_len",
        "score",
        "bit_score",
        "gaps"
    ]}

    return {
        **cleaned,
        **hsps,
        "name": hit["description"][0].get("sciname", "No name"),
        "len": hit["len"]
    }


async def get_ncbi_blast_result(config, run_in_process: callable, rid: str) -> dict:
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
        "FORMAT_OBJECT": "Alignment"
    }

    async with aiohttp.ClientSession() as session:
        async with virtool.http.proxy.ProxyRequest(config, session.get, BLAST_URL, params=params) as resp:
            data = await resp.read()
            return await run_in_process(extract_ncbi_blast_zip, data, rid)


def format_blast_content(result: dict) -> dict:
    """
    Format the BLAST result data into a format easily usable by Virtool.

    :param result: the raw BLAST result
    :return: the formatted BLAST result

    """
    if len(result) != 1:
        raise virtool.errors.NCBIError(f"Unexpected BLAST result count {len(result)} returned")

    result = result["BlastOutput2"]

    if len(result) != 1:
        raise virtool.errors.NCBIError(f"Unexpected BLAST result count {len(result)} returned")

    result = result["report"]

    output = {key: result[key] for key in ["program", "params", "version"]}

    output["target"] = result["search_target"]

    result = result["results"]["search"]

    try:
        output["masking"] = result["query_masking"]
    except KeyError:
        output["masking"] = None

    output["stat"] = result["stat"]
    output["hits"] = [format_blast_hit(h) for h in result["hits"]]

    return output


async def wait_for_blast_result(app, analysis_id, sequence_index, rid):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-format sequence
    document.

    """
    db = app["db"]
    config = app["config"]

    blast = virtool.analyses.db.BLAST(
        db,
        app["config"],
        analysis_id,
        sequence_index,
        rid
    )

    try:
        while not blast.ready:
            await blast.sleep()

            blast.ready = await check_rid(app["config"], rid)

            logger.debug(f"Checked BLAST {rid} ({blast.interval}s)")

            if blast.ready:
                try:
                    result_json = await get_ncbi_blast_result(
                        config,
                        app["run_in_process"],
                        rid
                    )
                except zipfile.BadZipFile:
                    await blast.update(False, None, error="Unable to interpret NCBI result")
                    return

                logger.debug(f"Retrieved result for BLAST {rid}")
                result = format_blast_content(result_json)

                await blast.update(True, result, None)
                return

            await blast.update(False, None, None)

    except asyncio.CancelledError:
        # Remove the BLAST record from the sequence if the server is shutdown.
        await blast.remove()
        logger.debug(f"Cancelled BLAST {rid}")
