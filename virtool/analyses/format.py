"""
Functions and data to use for formatting Pathoscope and NuVs analysis document. Formatted documents
are destined for API responses or CSV/Excel formatted file downloads.

"""
import asyncio
import csv
import io
import json
import statistics
from asyncio import gather
from collections import defaultdict
from typing import Any, Dict, List, Tuple

import aiofiles
import openpyxl.styles
import virtool.analyses.utils
import visvalingamwyatt as vw
from virtool.config.cls import Config
from virtool.history.db import patch_to_version
from virtool.otus.utils import format_isolate_name
from virtool.types import App

CSV_HEADERS = (
    "OTU",
    "Isolate",
    "Sequence",
    "Length",
    "Weight",
    "Median Depth",
    "Coverage"
)


def calculate_median_depths(hits: List[dict]) -> Dict[str, int]:
    """
    Calculate the median depth for all hits (sequences) in a Pathoscope result document.

    :param hits: the pathoscope analysis document to calculate depths for
    :return: a dict of median depths keyed by hit (sequence) ids

    """
    return {hit["id"]: statistics.median(hit["align"]) for hit in hits}


async def load_results(config: Config, document: Dict[str, Any]) -> dict:
    """
    Load the analysis results. Hide the alternative loading from a `results.json` file.
    These files are only generated if the analysis data would have exceeded the MongoDB size
    limit (16mb).

    The document is returned unmodified if loading from file is not required.

    :param config: the application configuration
    :param document: the document to load results for
    :return: a complete analysis document

    """
    if document["results"] == "file":
        path = virtool.analyses.utils.join_analysis_json_path(
            config.data_path,
            document["_id"],
            document["sample"]["id"]
        )

        async with aiofiles.open(path, "r") as f:
            data = json.loads(await f.read())
            return {
                **document,
                "results": data
            }

    return document


async def format_aodp(app: App, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format an AODP analysis document by retrieving the detected OTUs and incorporating them into
    the returned document.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document

    """
    hits = document["results"]["hits"]

    patched_otus = await gather_patched_otus(app, hits)

    hits_by_sequence_id = defaultdict(list)

    for hit in hits:
        hits_by_sequence_id[hit["sequence_id"]].append(hit)

    for otu in patched_otus.values():
        otu["id"] = otu.pop("_id")

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence["hits"] = hits_by_sequence_id[sequence["_id"]]
                sequence["id"] = sequence.pop("_id")

    return {
        **document,
        "results": {
            **document["results"],
            "hits": list(patched_otus.values())
        }
    }


async def format_pathoscope(app: App, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a Pathoscope analysis document by retrieving the detected OTUs and incorporating them
    into the returned document. Calculate metrics for different organizational levels: OTU,
    isolate, and sequence.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(
        app["config"],
        document
    )

    hits_by_otu = defaultdict(list)

    for hit in document["results"]["hits"]:
        otu_id = hit["otu"]["id"]
        otu_version = hit["otu"]["version"]

        hits_by_otu[(otu_id, otu_version)].append(hit)

    coros = list()

    for otu_specifier, hits in hits_by_otu.items():
        otu_id, otu_version = otu_specifier
        coros.append(format_pathoscope_hits(app, otu_id, otu_version, hits))

    return {
        **document,
        "results": {
            **document["results"],
            "hits": await gather(*coros)
        }
    }


async def format_pathoscope_hits(app: App, otu_id: str, otu_version, hits: List[Dict]):
    _, patched_otu, _ = await patch_to_version(
        app,
        otu_id,
        otu_version
    )

    max_sequence_length = 0

    for isolate in patched_otu["isolates"]:
        max_sequence_length = max(
            max_sequence_length,
            max([len(s["sequence"]) for s in isolate["sequences"]])
        )

    otu = {
        "id": otu_id,
        "name": patched_otu["name"],
        "version": patched_otu["version"],
        "abbreviation": patched_otu["abbreviation"],
        "isolates": patched_otu["isolates"],
        "length": max_sequence_length
    }

    hits_by_sequence_id = {hit["id"]: hit for hit in hits}

    return {
        **otu,
        "isolates": list(format_pathoscope_isolates(patched_otu["isolates"], hits_by_sequence_id))
    }


def format_pathoscope_isolates(
        isolates: List[Dict[str, Any]],
        hits_by_sequence_ids: Dict[str, dict]
) -> List[Dict[str, Any]]:
    for isolate in isolates:
        sequences = list(format_pathoscope_sequences(isolate["sequences"], hits_by_sequence_ids))

        if any((key in sequence for sequence in sequences) for key in ("pi", "final")):
            yield {
                **isolate,
                "sequences": sequences
            }


def format_pathoscope_sequences(sequences: List[Dict[str, Any]], hits_by_sequence_id: Dict[str, dict]):
    for sequence in sequences:
        try:
            hit = hits_by_sequence_id[sequence["_id"]]
        except KeyError:
            continue

        try:
            final = hit["final"]
        except KeyError:
            final = dict()

        align = hit.get("align")

        if align:
            align = transform_coverage_to_coordinates(align)

        yield {
            "id": sequence["_id"],
            "accession": sequence["accession"],
            "align": align,
            "best": final.get("best", 0),
            "coverage": hit.get("coverage", 0),
            "definition": sequence["definition"],
            "length": len(sequence["sequence"]),
            "pi": final.get("pi", 0),
            "reads": final.get("reads", 0),
        }


async def format_nuvs(app: App, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format a NuVs analysis document by attaching the HMM annotation data to the results.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(
        app["config"],
        document
    )

    hits = document["results"]["hits"]

    hit_ids = list({h["hit"] for s in hits for o in s["orfs"] for h in o["hits"]})

    cursor = app["db"].hmm.find({"_id": {"$in": hit_ids}}, ["cluster", "families", "names"])

    hmms = {d.pop("_id"): d async for d in cursor}

    for sequence in document["results"]:
        for orf in sequence["orfs"]:
            for hit in orf["hits"]:
                hit.update(hmms[hit["hit"]])

    return document


async def format_analysis_to_excel(app: App, document: Dict[str, Any]) -> bytes:
    """
    Convert a pathoscope analysis document to byte-encoded Excel format for download.

    :param app: the application object
    :param document: the document to format
    :return: the formatted Excel workbook

    """
    depths = calculate_median_depths(document["hits"])

    formatted = await format_analysis(app, document)

    output = io.BytesIO()

    wb = openpyxl.Workbook()
    ws = wb.active

    ws.title = f"Pathoscope for {document['sample']['id']}"

    header_font = openpyxl.styles.Font(name="Calibri", bold=True)

    for index, header in enumerate(CSV_HEADERS):
        col = index + 1
        cell = ws.cell(column=col, row=1, value=header)
        cell.font = header_font

    rows = list()

    for otu in formatted["results"]:
        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                row = [
                    otu["name"],
                    format_isolate_name(isolate),
                    sequence["accession"],
                    sequence["length"],
                    sequence["pi"],
                    depths.get(sequence["id"], 0),
                    sequence["coverage"]
                ]

                assert len(row) == len(CSV_HEADERS)

                rows.append(row)

    for row_index, row in enumerate(rows):
        row_number = row_index + 2
        for col_index, value in enumerate(row):
            ws.cell(column=col_index + 1, row=row_number, value=value)

    wb.save(output)

    return output.getvalue()


async def format_analysis_to_csv(app: App, document: Dict[str, Any]) -> str:
    """
    Convert a pathoscope analysis document to CSV format for download.

    :param app: the application object
    :param document: the document to format
    :return: the formatted CSV data

    """
    depths = calculate_median_depths(document["hits"])

    formatted = await format_analysis(app, document)

    output = io.StringIO()

    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)

    writer.writerow(CSV_HEADERS)

    for otu in formatted["results"]:
        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                row = [
                    otu["name"],
                    format_isolate_name(isolate),
                    sequence["accession"],
                    sequence["length"],
                    sequence["pi"],
                    depths.get(sequence["id"], 0),
                    sequence["coverage"]
                ]

                writer.writerow(row)

    return output.getvalue()


async def format_analysis(app: App, document: Dict[str, Any]) -> Dict[str, any]:
    """
    Format an analysis document to be returned by the API.

    :param app: the application object
    :param document: the analysis document to format
    :return: a formatted document

    """
    workflow = document.get("workflow")

    if workflow:
        if workflow == "nuvs":
            return await format_nuvs(app, document)

        if "pathoscope" in workflow:
            return await format_pathoscope(app, document)

        if workflow == "aodp":
            return await format_aodp(app, document)

    raise ValueError("Could not determine analysis workflow")


async def gather_patched_otus(app: App, results: List[dict]) -> Dict[str, dict]:
    """
    Gather patched OTUs for each result item. Only fetch each id-version combination once. Make
    database requests concurrently to save time.

    :param app: the application object
    :param results: the results field from a pathoscope analysis document
    :return: a dict containing patched OTUs keyed by the OTU ID

    """
    # Use set to only id-version combinations once.
    otu_specifiers = {(hit["otu"]["id"], hit["otu"]["version"]) for hit in results}

    patched_otus = await asyncio.gather(*[
        patch_to_version(
            app,
            otu_id,
            version
        ) for otu_id, version in otu_specifiers
    ])

    return {patched["_id"]: patched for _, patched, _ in patched_otus}


def transform_coverage_to_coordinates(coverage_list: List[int]) -> List[Tuple[int, int]]:
    """
    Takes a list of read depths where the list index is equal to the read position + 1 and returns
    a list of (x, y) coordinates.
    The coordinates will be simplified using Visvalingham-Wyatt algorithm if the list exceeds 100
    pairs.
    :param coverage_list: a list of position-indexed depth values
    :return: a list of (x, y) coordinates
    """
    coordinates = [(0, coverage_list[0])]

    last = len(coverage_list) - 1

    for x in range(1, last):
        y = coverage_list[x]
        if y != coverage_list[x - 1] or y != coverage_list[x + 1]:
            coordinates.append((x, y))

    coordinates.append((last, coverage_list[last]))

    if len(coordinates) > 100:
        return vw.simplify(coordinates, ratio=0.4)

    return coordinates
