"""Functions and data to use for formatting Pathoscope and NuVs analysis document.

Formatted documents are destined for API responses or CSV/Excel formatted file
downloads.
"""

import asyncio
import csv
import io
import statistics
from asyncio import gather
from collections import defaultdict
from typing import TYPE_CHECKING, Any

import openpyxl.styles
import visvalingamwyatt as vw

import virtool.analyses.utils
from virtool.config.cls import Config
from virtool.history.db import patch_to_version
from virtool.models.enums import AnalysisWorkflow
from virtool.otus.utils import format_isolate_name
from virtool.utils import load_json

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


CSV_HEADERS = (
    "OTU",
    "Isolate",
    "Sequence",
    "Length",
    "Weight",
    "Median Depth",
    "Coverage",
)


def calculate_median_depths(hits: list[dict]) -> dict[str, int]:
    """Calculate the median depth for all hits (sequences) in a Pathoscope result
    document.

    :param hits: the pathoscope analysis document to calculate depths for
    :return: a dict of median depths keyed by hit (sequence) ids

    """
    return {hit["id"]: statistics.median(hit["align"]) for hit in hits}


async def load_results(config: Config, document: dict[str, Any]) -> dict:
    """Load the analysis results. Hide the alternative loading from a `results.json`
    file.

    These files are only generated if the analysis data had exceeded the MongoDB size
    limit (16 MB.

    The document is returned unmodified if loading from file is not required.

    :param config: the application configuration
    :param document: the document to load results for
    :return: a complete analysis document

    """
    if document["results"] == "file":
        path = virtool.analyses.utils.join_analysis_json_path(
            config.data_path,
            document["_id"],
            document["sample"]["id"],
        )

        data = await asyncio.to_thread(load_json, path)

        return {**document, "results": data}

    return document


async def format_aodp(
    config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> dict[str, Any]:
    """Format an AODP analysis document by retrieving the detected OTUs and
    incorporating them into the returned document.

    :param config: the application config object
    :param mongo: the application Mongo object
    :param document: the document to format
    :return: the formatted document

    """
    hits = document["results"]["hits"]

    patched_otus = await gather_patched_otus(config, mongo, hits)

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
        "results": {**document["results"], "hits": list(patched_otus.values())},
    }


async def format_pathoscope(
    config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> dict[str, Any]:
    """Format a Pathoscope analysis document by retrieving the detected OTUs and
    incorporating them into the returned document.

    Calculate metrics for different organizational levels: OTU, isolate, and sequence.

    :param config: the application config object
    :param mongo: the application Mongo object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(config, document)

    hits_by_otu = defaultdict(list)

    for hit in document["results"]["hits"]:
        otu_id = hit["otu"]["id"]
        otu_version = hit["otu"]["version"]

        hits_by_otu[(otu_id, otu_version)].append(hit)

    coros = []

    for otu_specifier, hits in hits_by_otu.items():
        otu_id, otu_version = otu_specifier
        coros.append(format_pathoscope_hits(config, mongo, otu_id, otu_version, hits))

    return {
        **document,
        "results": {**document["results"], "hits": await gather(*coros)},
    }


async def format_pathoscope_hits(
    config,
    mongo: "Mongo",
    otu_id: str,
    otu_version,
    hits: list[dict],
):
    _, patched_otu, _ = await patch_to_version(
        config.data_path,
        mongo,
        otu_id,
        otu_version,
    )

    max_sequence_length = 0

    for isolate in patched_otu["isolates"]:
        max_sequence_length = max(
            max_sequence_length,
            max(len(s["sequence"]) for s in isolate["sequences"]),
        )

    hits_by_sequence_id = {hit["id"]: hit for hit in hits}

    return {
        "id": otu_id,
        "abbreviation": patched_otu["abbreviation"],
        "name": patched_otu["name"],
        "isolates": list(
            format_pathoscope_isolates(patched_otu["isolates"], hits_by_sequence_id),
        ),
        "length": max_sequence_length,
        "version": patched_otu["version"],
    }


def format_pathoscope_isolates(
    isolates: list[dict[str, Any]],
    hits_by_sequence_ids: dict[str, dict],
) -> list[dict[str, Any]]:
    for isolate in isolates:
        sequences = list(
            format_pathoscope_sequences(isolate["sequences"], hits_by_sequence_ids),
        )

        if any(
            any(key in sequence for sequence in sequences) for key in ("pi", "final")
        ):
            yield {**isolate, "sequences": sequences}


def format_pathoscope_sequences(
    sequences: list[dict[str, Any]],
    hits_by_sequence_id: dict[str, dict],
):
    for sequence in sequences:
        try:
            hit = hits_by_sequence_id[sequence["_id"]]
        except KeyError:
            continue

        try:
            final = hit["final"]
        except KeyError:
            final = {}

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


async def format_nuvs(
    config: Config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> dict[str, Any]:
    """Format a NuVs analysis document by attaching the HMM annotation data to the
    results.

    :param config: the config object
    :param mongo: the database object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(config, document)

    hits = document["results"]["hits"]

    hit_ids = list({h["hit"] for s in hits for o in s["orfs"] for h in o["hits"]})

    cursor = mongo.hmm.find({"_id": {"$in": hit_ids}}, ["cluster", "families", "names"])

    hmms = {d.pop("_id"): d async for d in cursor}

    for sequence in hits:
        for orf in sequence["orfs"]:
            for hit in orf["hits"]:
                hit.update(hmms[hit["hit"]])

    return document


async def format_analysis_to_excel(
    config: Config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> bytes:
    """Convert a pathoscope analysis document to byte-encoded Excel format for download.

    :param config: the config object
    :param mongo: the database object
    :param document: the document to format
    :return: the formatted Excel workbook

    """
    depths = calculate_median_depths(document["results"]["hits"])

    formatted = await format_analysis(config, mongo, document)

    output = io.BytesIO()

    wb = openpyxl.Workbook()
    ws = wb.active

    ws.title = f"Pathoscope for {document['sample']['id']}"

    header_font = openpyxl.styles.Font(name="Calibri", bold=True)

    for index, header in enumerate(CSV_HEADERS):
        col = index + 1
        cell = ws.cell(column=col, row=1, value=header)
        cell.font = header_font

    rows = []

    for otu in formatted["results"]["hits"]:
        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                row = [
                    otu["name"],
                    format_isolate_name(isolate),
                    sequence["accession"],
                    sequence["length"],
                    sequence["pi"],
                    depths.get(sequence["id"], 0),
                    sequence["coverage"],
                ]

                assert len(row) == len(CSV_HEADERS)

                rows.append(row)

    for row_index, row in enumerate(rows):
        row_number = row_index + 2
        for col_index, value in enumerate(row):
            ws.cell(column=col_index + 1, row=row_number, value=value)

    wb.save(output)

    return output.getvalue()


async def format_analysis_to_csv(
    config: Config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> str:
    """Convert a pathoscope analysis document to CSV format for download.

    :param config: the app config object
    :param mongo: the app mongo object
    :param document: the document to format
    :return: the formatted CSV data

    """
    depths = calculate_median_depths(document["results"]["hits"])

    formatted = await format_analysis(config, mongo, document)

    output = io.StringIO()

    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)

    writer.writerow(CSV_HEADERS)

    for otu in formatted["results"]["hits"]:
        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                row = [
                    otu["name"],
                    format_isolate_name(isolate),
                    sequence["accession"],
                    sequence["length"],
                    sequence["pi"],
                    depths.get(sequence["id"], 0),
                    sequence["coverage"],
                ]

                writer.writerow(row)

    return output.getvalue()


async def format_analysis(
    config: Config,
    mongo: "Mongo",
    document: dict[str, Any],
) -> dict[str, any]:
    """Format an analysis document to be returned by the API.

    :param config: the config object
    :param mongo: the database object
    :param document: the analysis document to format
    :return: a formatted document

    """
    workflow = document.get("workflow")

    if workflow is None:
        raise ValueError("Analysis has no workflow field")

    if workflow == AnalysisWorkflow.nuvs.value:
        return await format_nuvs(config, mongo, document)

    if workflow == AnalysisWorkflow.aodp.value:
        return await format_aodp(config, mongo, document)

    if "pathoscope" in workflow:
        return await format_pathoscope(config, mongo, document)

    if workflow == AnalysisWorkflow.iimi.value:
        return document

    raise ValueError(f"Unknown workflow: {workflow}")


async def gather_patched_otus(
    config,
    mongo: "Mongo",
    results: list[dict],
) -> dict[str, dict]:
    """Gather patched OTUs for each result item. Only fetch each id-version combination
    once.

    :param config: the config object
    :param mongo: the database object
    :param results: the results field from a pathoscope analysis document
    :return: a dict containing patched OTUs keyed by the OTU ID

    """
    # Use set to only id-version combinations once.
    otu_specifiers = {(hit["otu"]["id"], hit["otu"]["version"]) for hit in results}

    patched_otus = await asyncio.gather(
        *[
            patch_to_version(config.data_path, mongo, otu_id, version)
            for otu_id, version in otu_specifiers
        ],
    )

    return {patched["_id"]: patched for _, patched, _ in patched_otus}


def transform_coverage_to_coordinates(
    coverage_list: list[int],
) -> list[tuple[int, int]]:
    """Takes a list of read depths where the list index is equal to the read position
    plus one and returns a list of (x, y) coordinates.

    The coordinates will be simplified using Visvalingham-Wyatt algorithm if the list
    exceeds 100 pairs.

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
