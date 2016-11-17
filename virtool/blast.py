import re
import io
import json
import time
import requests
import zipfile


def extract_blast_info(html):
    return html.split("<!--QBlastInfoBegin")[1].split("QBlastInfoEnd")[0]


def initialize(sequence):
    """
    Send a request to NCBI to BLAST the passed sequence. Return the RID and RTOE from the response.

    :param sequence: the nucleotide sequence to BLAST
    :type sequence: str

    :return: the RID and RTOE for the request
    :rtype: tuple

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
        "QUERY": sequence,
    }

    # Send the request to NCBI.
    response = requests.post("https://blast.ncbi.nlm.nih.gov/Blast.cgi", params=params, data=data)

    # Get the text from in the 'QBlastInfo' comment tag.
    blast_info = extract_blast_info(response.text)

    # Extract the RID and RTOE from the QBlastInfo.
    match = re.search(r"RID = (.+)", blast_info)
    rid = match.group(1)

    match = re.search(r"RTOE = (.+)", blast_info)
    rtoe = match.group(1)

    return rid, rtoe


def check_rid(rid):
    """
    Check if the BLAST process identified by the passed RID is ready.

    :param rid: the RID to check
    :type rid: str

    :return: ``True`` if ready, ``False`` otherwise
    :rtype: bool

    """
    query = "&".join([
        "CMD=Get",
        "RID=" + rid,
        "FORMAT_OBJECT=SearchInfo"
    ])

    response = requests.get("https://blast.ncbi.nlm.nih.gov/Blast.cgi?" + query)

    return "Status=WAITING" not in response.text


def retrieve_result(rid):
    response = requests.get("https://blast.ncbi.nlm.nih.gov/Blast.cgi", {
        "CMD": "Get",
        "RID": rid,
        "FORMAT_TYPE": "JSON2",
        "FORMAT_OBJECT": "Alignment"
    })

    return parse_content(response, rid)


def parse_content(response, rid):
    zipped = zipfile.ZipFile(io.BytesIO(response.content))
    string = zipped.open(rid + "_1.json", "r").read().decode()

    result = json.loads(string)

    assert len(result) == 1

    result = result["BlastOutput2"]

    assert len(result) == 1

    result = result["report"]

    output = {key: result[key] for key in ["program", "params", "version"]}

    output["target"] = result["search_target"]

    result = result["results"]["search"]

    output["masking"] = result["query_masking"]
    output["stat"] = result["stat"]

    output["hits"] = list()

    for hit in result["hits"]:
        cleaned = {key: hit["description"][0][key] for key in ["taxid", "title", "accession"]}

        cleaned["len"] = hit["len"]
        cleaned["name"] = hit["description"][0]["sciname"]

        hsps = {key: hit["hsps"][0][key] for key in [
            "identity",
            "evalue",
            "align_len",
            "score",
            "bit_score",
            "gaps"
        ]}

        cleaned.update(hsps)

        output["hits"].append(cleaned)

    return output


def blast(sequence):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-format sequence
    document.

    :param sequence: the nucleotide or protein sequence to BLAST.
    :type sequence: str

    """
    rid, rtoe = initialize(sequence)

    is_ready = False
    interval = 3

    while not is_ready:
        time.sleep(interval)
        interval += 5
        is_ready = check_rid(rid)

    return retrieve_result(rid)
