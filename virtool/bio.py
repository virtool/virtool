import asyncio
import gzip
import io
import json
import re
import zipfile
from typing import Awaitable

import aiohttp

import virtool.analyses.utils
import virtool.errors
import virtool.http.proxy
import virtool.utils

BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi"

COMPLEMENT_TABLE = {
    "A": "T",
    "T": "A",
    "G": "C",
    "C": "G",
    "N": "N"
}

#: A standard translation table, including ambiguity.
TRANSLATION_TABLE = {
    "TTT": "F",
    "TTC": "F",

    "TTA": "L",
    "TTG": "L",
    "CTT": "L",
    "CTC": "L",
    "CTA": "L",
    "CTG": "L",
    "CTN": "L",

    "ATT": "I",
    "ATC": "I",
    "ATA": "I",

    "ATG": "M",

    "GTT": "V",
    "GTC": "V",
    "GTA": "V",
    "GTG": "V",
    "GTN": "V",

    "TCT": "S",
    "TCC": "S",
    "TCA": "S",
    "TCG": "S",
    "TCN": "S",
    "AGT": "S",
    "AGC": "S",

    "CCT": "P",
    "CCC": "P",
    "CCA": "P",
    "CCG": "P",
    "CCN": "P",

    "ACT": "T",
    "ACC": "T",
    "ACA": "T",
    "ACG": "T",
    "ACN": "T",

    "GCT": "A",
    "GCC": "A",
    "GCA": "A",
    "GCG": "A",
    "GCN": "A",

    "TAT": "Y",
    "TAC": "Y",

    "TAA": "*",
    "TAG": "*",
    "TGA": "*",

    "CAT": "H",
    "CAC": "H",

    "CAA": "Q",
    "CAG": "Q",

    "AAT": "N",
    "AAC": "N",

    "AAA": "K",
    "AAG": "K",

    "GAT": "D",
    "GAC": "D",

    "GAA": "E",
    "GAG": "E",

    "TGT": "C",
    "TGC": "C",

    "TGG": "W",

    "CGT": "R",
    "CGC": "R",
    "CGA": "R",
    "CGG": "R",
    "CGN": "R",
    "AGA": "R",
    "AGG": "R",

    "GGT": "G",
    "GGC": "G",
    "GGA": "G",
    "GGG": "G",
    "GGN": "G"
}


def read_fasta(path):
    data = list()

    with open(path, "r") as f:
        header = None
        seq = []

        for line in f:
            if line[0] == ">":
                if header:
                    data.append((header, "".join(seq)))

                header = line.rstrip().replace(">", "")
                seq = []
                continue

            if header:
                seq.append(line.rstrip())
                continue

            raise IOError(f"Illegal FASTA line: {line}")

        if header:
            data.append((header, "".join(seq)))

    return data


def read_fastq(f):
    data = list()

    had_plus = False

    header = None
    seq = None

    for line in f:
        if line == "+\n":
            had_plus = True
            continue

        if not had_plus:
            if line[0] == "@":
                header = line.rstrip()
                continue

            seq = line.rstrip()
            continue

        if had_plus:
            yield (header, seq, line.rstrip())

            header = None
            seq = None
            had_plus = False

    return data


def read_fastq_from_path(path):
    try:
        with open(path, "r") as f:
            for record in read_fastq(f):
                yield record
    except UnicodeDecodeError:
        with gzip.open(path, "rt") as f:
            for record in read_fastq(f):
                yield record


def read_fastq_headers(path):
    headers = list()

    had_plus = False

    with open(path, "r") as f:
        for line in f:
            if line == "+\n":
                had_plus = True
                continue

            if not had_plus and line[0] == "@":
                headers.append(line.rstrip())
                continue

            if had_plus:
                had_plus = False

    return headers


def reverse_complement(sequence):
    sequence = sequence.upper()

    complement = [COMPLEMENT_TABLE[s] for s in sequence]
    complement.reverse()

    return "".join(complement)


def translate(sequence):
    sequence = sequence.upper()

    protein = list()

    for i in range(0, len(sequence) // 3):
        codon = sequence[i * 3:(i + 1) * 3]

        # Translate to X if the codon matches no amino acid (taking into account ambiguous codons where possible)
        protein.append(TRANSLATION_TABLE.get(codon, "X"))

    return "".join(protein)


def find_orfs(sequence):
    orfs = list()

    sequence_length = len(sequence)

    # Only look for ORFs if the contig is at least 300 nucleotides long.
    if sequence_length > 300:
        # Looks at both forward (+) and reverse (-) strands.
        for strand, nuc in [(+1, sequence), (-1, reverse_complement(sequence))]:
            # Look in all three translation frames.
            for frame in range(3):
                translation = translate(nuc[frame:])
                translation_length = len(translation)

                aa_start = 0

                # Extract ORFs.
                while aa_start < translation_length:
                    aa_end = translation.find("*", aa_start)

                    if aa_end == -1:
                        aa_end = translation_length
                    if aa_end - aa_start >= 100:
                        if strand == 1:
                            start = frame + aa_start * 3
                            end = min(sequence_length, frame + aa_end * 3 + 3)
                        else:
                            start = sequence_length - frame - aa_end * 3 - 3
                            end = sequence_length - frame - aa_start * 3

                        orfs.append({
                            "pro": str(translation[aa_start:aa_end]),
                            "nuc": str(nuc[start:end]),
                            "frame": frame,
                            "strand": strand,
                            "pos": (start, end)
                        })

                    aa_start = aa_end + 1

    return orfs


async def initialize_ncbi_blast(settings: dict, sequence: str) -> Awaitable[tuple]:
    """
    Send a request to NCBI to BLAST the passed sequence. Return the RID and RTOE from the response.

    :param settings: the application settings object

    :param sequence: the nucleotide sequence to BLAST

    :return: the RID and RTOE for the request
    :rtype:

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

    async with aiohttp.ClientSession() as session:
        async with virtool.http.proxy.ProxyRequest(settings, session.post, BLAST_URL, params=params, data=data) as resp:
            if resp.status != 200:
                raise virtool.errors.NCBIError(f"BLAST request returned status: {resp.status}")

            # Extract and return the RID and RTOE from the QBlastInfo tag.
            return extract_blast_info(await resp.text())


def extract_blast_info(html):
    """
    Extract the RID and RTOE from BLAST HTML data containing a <QBlastInfo /> tag.

    :param html: the input HTML
    :type html: str

    :return: a tuple containing the RID and RTOE
    :rtype: tuple

    """
    string = html.split("<!--QBlastInfoBegin")[1].split("QBlastInfoEnd")[0]

    match = re.search(r"RID = (.+)", string)
    rid = match.group(1)

    match = re.search(r"RTOE = (.+)", string)
    rtoe = match.group(1)

    return rid, int(rtoe)


async def check_rid(settings, rid):
    """
    Check if the BLAST process identified by the passed RID is ready.

    :param rid: the RID to check
    :type rid: str

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :return: ``True`` if ready, ``False`` otherwise
    :rtype: Coroutine[bool]

    """
    params = {
        "CMD": "Get",
        "RID": rid,
        "FORMAT_OBJECT": "SearchInfo"
    }

    async with aiohttp.ClientSession() as session:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, BLAST_URL, params=params) as resp:
            if resp.status != 200:
                raise virtool.errors.NCBIError(f"RID check request returned status {resp.status}")

            return "Status=WAITING" not in await resp.text()


async def get_ncbi_blast_result(settings, rid):
    params = {
        "CMD": "Get",
        "RID": rid,
        "FORMAT_TYPE": "JSON2",
        "FORMAT_OBJECT": "Alignment"
    }

    async with aiohttp.ClientSession() as session:
        async with virtool.http.proxy.ProxyRequest(settings, session.get, BLAST_URL, params=params) as resp:
            return parse_blast_content(await resp.read(), rid)


def parse_blast_content(content, rid):
    zipped = zipfile.ZipFile(io.BytesIO(content))
    string = zipped.open(rid + "_1.json", "r").read().decode()

    result = json.loads(string)

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

    output["hits"] = list()

    for hit in result["hits"]:
        cleaned = {key: hit["description"][0].get(key, "") for key in ["taxid", "title", "accession"]}

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


async def wait_for_blast_result(db, settings, analysis_id, sequence_index, rid):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-format sequence
    document.

    """
    try:
        ready = False
        interval = 3

        while not ready:
            await asyncio.sleep(interval)

            # Do this before checking RID for more accurate time.
            last_checked_at = virtool.utils.timestamp()

            ready = await check_rid(settings, rid)

            update = {
                "interval": interval,
                "last_checked_at": last_checked_at,
                "ready": ready,
                "rid": rid
            }

            interval += 5

            if update["ready"]:
                update["result"] = await get_ncbi_blast_result(settings, rid)

            await db.analyses.update_one({"_id": analysis_id, "results.index": sequence_index}, {
                "$set": {
                    "results.$.blast": update
                }
            })
    except asyncio.CancelledError:
        # Remove the BLAST record from the sequence if the server is shutdown.
        await db.analyses.update_one({"_id": analysis_id, "results.index": sequence_index}, {
            "$set": {
                "results.$.blast": None
            }
        })
