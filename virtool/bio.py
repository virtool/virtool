import asyncio
import gzip
import io
import json
import logging
import re
import zipfile
from typing import Generator, List

import aiohttp

import virtool.analyses.db
import virtool.errors
import virtool.http.proxy
import virtool.utils

logger = logging.getLogger(__name__)

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


def read_fasta(path: str) -> List[tuple]:
    """
    Parse the FASTA file at `path` and return its content as a `list` of tuples containing the header and sequence.

    :param path: the path to the FASTA file
    :return: the FASTA content

    """
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


def read_fastq(f) -> Generator[tuple, None, list]:
    """
    Read the FASTQ content in the file object `f`. Yields tuples containing the header, sequence, and quality.

    :param f: a file handle
    :return: the FASTQ content as tuples

    """
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
            yield header, seq, line.rstrip()

            header = None
            seq = None
            had_plus = False

    return list()


def read_fastq_from_path(path: str) -> Generator[tuple, None, None]:
    """
    Read the FASTQ file at `path` and yields its content as tuples. Accepts both uncompressed and GZIP-compressed FASTQ
    files.

    :param path: the path to the FASTQ File
    :return: tuples containing the header, sequence, and quality

    """
    try:
        with open(path, "r") as f:
            for record in read_fastq(f):
                yield record
    except UnicodeDecodeError:
        with gzip.open(path, "rt") as f:
            for record in read_fastq(f):
                yield record


def read_fastq_headers(path: str) -> list:
    """
    Return a list of FASTQ headers for the FASTQ file located at `path`. Only accepts uncompressed FASTQ files.

    :param path: the path to the FASTQ file
    :return: a list of FASTQ headers

    """
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


def reverse_complement(sequence: str) -> str:
    """
    Calculate the reverse complement of the passed `sequence`.

    :param sequence: the sequence to transform
    :return: the reverse complement
    """
    complement = [COMPLEMENT_TABLE[s] for s in sequence.upper()]
    complement.reverse()

    return "".join(complement)


def translate(sequence: str) -> str:
    """
    Translate the passed nucleotide sequence to protein. Substitutes _X_ for invalid codons.

    :param sequence: the nucleotide sequence
    :return: a translated protein sequence

    """
    sequence = sequence.upper()

    protein = list()

    for i in range(0, len(sequence) // 3):
        codon = sequence[i * 3:(i + 1) * 3]

        # Translate to X if the codon matches no amino acid (taking into account ambiguous codons where possible)
        protein.append(TRANSLATION_TABLE.get(codon, "X"))

    return "".join(protein)


def find_orfs(sequence: str) -> List[dict]:
    """
    Return all ORFs for the nucelotide sequence. No ORFs will be returned for sequences shorter than 300 bp. Only ORFs
    100 residues long or greater will be returned.

    :param sequence:
    :return: a list of ORFs and metadata
    """
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


async def initialize_ncbi_blast(settings: dict, sequence: dict) -> tuple:
    """
    Send a request to NCBI to BLAST the passed sequence. Return the RID and RTOE from the response.

    :param settings: the application settings object
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
        async with virtool.http.proxy.ProxyRequest(settings, session.post, BLAST_URL, params=params, data=data) as resp:
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


async def check_rid(settings: dict, rid: str) -> bool:
    """
    Check if the BLAST process identified by the passed RID is ready.

    :param rid: the RID to check
    :param settings: the application settings object
    :return: ``True`` if ready, ``False`` otherwise

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


async def get_ncbi_blast_result(settings: dict, run_in_process: callable, rid: str) -> dict:
    """
    Retrieve the BLAST result with the given `rid` from NCBI.

    :param settings: the application settings
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
        async with virtool.http.proxy.ProxyRequest(settings, session.get, BLAST_URL, params=params) as resp:
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
    settings = app["settings"]

    blast = virtool.analyses.db.BLAST(
        db,
        settings,
        analysis_id,
        sequence_index,
        rid
    )

    try:
        while not blast.ready:
            await blast.sleep()

            blast.ready = await check_rid(settings, rid)

            logger.debug(f"Checked BLAST {rid} ({blast.interval}s)")

            if blast.ready:
                try:
                    result_json = await get_ncbi_blast_result(
                        settings,
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
