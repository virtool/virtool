"""Functions and data to use for formatting Pathoscope and NuVs analysis results.

Formatted results are destined for API responses or CSV/Excel formatted file
downloads.
"""

import csv
import io
import json
import statistics
from asyncio import gather
from collections import defaultdict
from typing import TYPE_CHECKING, Any

import openpyxl.styles
import visvalingamwyatt as vw
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.analyses.utils import analysis_result_key
from virtool.history.db import patch_to_version
from virtool.models.enums import AnalysisWorkflow
from virtool.otus.utils import format_isolate_name
from virtool.storage.protocol import StorageBackend

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


async def load_results(
    storage: StorageBackend,
    *,
    results: dict[str, Any] | str,
    legacy_id: str,
    sample_id: str,
) -> dict:
    """Load the analysis results from storage when they were too large for MongoDB.

    The results are returned unmodified if loading from storage is not required.

    :param storage: the storage backend
    :param results: the results payload, or the literal ``"file"`` when offloaded
    :param legacy_id: the legacy analysis id used to build the storage key
    :param sample_id: the id of the parent sample used to build the storage key
    :return: the loaded results dict
    """
    if results == "file":
        key = analysis_result_key(legacy_id, sample_id)

        chunks = []
        async for chunk in storage.read(key):
            chunks.append(chunk)

        return json.loads(b"".join(chunks))

    return results


async def format_aodp(
    mongo: "Mongo",
    pg: AsyncEngine,
    *,
    results: dict[str, Any],
) -> dict[str, Any]:
    """Format AODP analysis results by retrieving the detected OTUs and incorporating
    them into the returned results.

    :param mongo: the application Mongo object
    :param pg: the application PostgreSQL database object
    :param results: the results to format
    :return: the formatted results

    """
    hits = results["hits"]

    patched_otus = await gather_patched_otus(mongo, pg, hits)

    hits_by_sequence_id = defaultdict(list)

    for hit in hits:
        hits_by_sequence_id[hit["sequence_id"]].append(hit)

    for otu in patched_otus.values():
        otu["id"] = otu.pop("_id")

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence["hits"] = hits_by_sequence_id[sequence["_id"]]
                sequence["id"] = sequence.pop("_id")

    return {**results, "hits": list(patched_otus.values())}


async def format_pathoscope(
    storage: StorageBackend,
    mongo: "Mongo",
    pg: AsyncEngine,
    *,
    results: dict[str, Any] | str,
    legacy_id: str,
    sample_id: str,
) -> dict[str, Any]:
    """Format Pathoscope analysis results by retrieving the detected OTUs and
    incorporating them into the returned results.

    Calculate metrics for different organizational levels: OTU, isolate, and sequence.

    :param storage: the storage backend
    :param mongo: the application Mongo object
    :param pg: the application PostgreSQL database object
    :param results: the results to format, or the literal ``"file"`` when offloaded
    :param legacy_id: the legacy analysis id used to load offloaded results
    :param sample_id: the id of the parent sample used to load offloaded results
    :return: the formatted results

    """
    results = await load_results(
        storage,
        results=results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    hits_by_otu = defaultdict(list)

    for hit in results["hits"]:
        otu_id = hit["otu"]["id"]
        otu_version = hit["otu"]["version"]

        hits_by_otu[(otu_id, otu_version)].append(hit)

    coros = []

    for otu_specifier, hits in hits_by_otu.items():
        otu_id, otu_version = otu_specifier
        coros.append(format_pathoscope_hits(mongo, pg, otu_id, otu_version, hits))

    return {**results, "hits": await gather(*coros)}


async def format_pathoscope_hits(
    mongo: "Mongo",
    pg: AsyncEngine,
    otu_id: str,
    otu_version,
    hits: list[dict],
):
    _, patched_otu, _ = await patch_to_version(
        mongo,
        pg,
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
    storage: StorageBackend,
    mongo: "Mongo",
    *,
    results: dict[str, Any] | str,
    legacy_id: str,
    sample_id: str,
) -> dict[str, Any]:
    """Format NuVs analysis results by attaching the HMM annotation data to the hits.

    :param storage: the storage backend
    :param mongo: the database object
    :param results: the results to format, or the literal ``"file"`` when offloaded
    :param legacy_id: the legacy analysis id used to load offloaded results
    :param sample_id: the id of the parent sample used to load offloaded results
    :return: the formatted results

    """
    results = await load_results(
        storage,
        results=results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    hits = results["hits"]

    hit_ids = list({h["hit"] for s in hits for o in s["orfs"] for h in o["hits"]})

    cursor = mongo.hmm.find({"_id": {"$in": hit_ids}}, ["cluster", "families", "names"])

    hmms = {d.pop("_id"): d async for d in cursor}

    for sequence in hits:
        for orf in sequence["orfs"]:
            for hit in orf["hits"]:
                hit.update(hmms[hit["hit"]])

    return results


async def format_analysis_to_excel(
    storage: StorageBackend,
    mongo: "Mongo",
    pg: AsyncEngine,
    *,
    results: dict[str, Any] | str,
    workflow: str,
    sample_id: str,
    legacy_id: str,
) -> bytes:
    """Convert pathoscope analysis results to byte-encoded Excel format for download.

    :param storage: the storage backend
    :param mongo: the database object
    :param pg: the application PostgreSQL database object
    :param results: the results to format
    :param workflow: the analysis workflow
    :param sample_id: the id of the parent sample
    :param legacy_id: the legacy analysis id used to load offloaded results
    :return: the formatted Excel workbook

    """
    loaded_results = await load_results(
        storage,
        results=results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    depths = calculate_median_depths(loaded_results["hits"])

    formatted = await format_analysis(
        storage,
        mongo,
        pg,
        workflow=workflow,
        results=loaded_results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    output = io.BytesIO()

    wb = openpyxl.Workbook()
    ws = wb.active

    ws.title = f"Pathoscope for {sample_id}"

    header_font = openpyxl.styles.Font(name="Calibri", bold=True)

    for index, header in enumerate(CSV_HEADERS):
        col = index + 1
        cell = ws.cell(column=col, row=1, value=header)
        cell.font = header_font

    rows = []

    for otu in formatted["hits"]:
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
    storage: StorageBackend,
    mongo: "Mongo",
    pg: AsyncEngine,
    *,
    results: dict[str, Any] | str,
    workflow: str,
    sample_id: str,
    legacy_id: str,
) -> str:
    """Convert pathoscope analysis results to CSV format for download.

    :param storage: the storage backend
    :param mongo: the app mongo object
    :param pg: the application PostgreSQL database object
    :param results: the results to format
    :param workflow: the analysis workflow
    :param sample_id: the id of the parent sample
    :param legacy_id: the legacy analysis id used to load offloaded results
    :return: the formatted CSV data

    """
    loaded_results = await load_results(
        storage,
        results=results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    depths = calculate_median_depths(loaded_results["hits"])

    formatted = await format_analysis(
        storage,
        mongo,
        pg,
        workflow=workflow,
        results=loaded_results,
        legacy_id=legacy_id,
        sample_id=sample_id,
    )

    output = io.StringIO()

    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)

    writer.writerow(CSV_HEADERS)

    for otu in formatted["hits"]:
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
    storage: StorageBackend,
    mongo: "Mongo",
    pg: AsyncEngine,
    *,
    workflow: str | None,
    results: dict[str, Any] | str,
    legacy_id: str,
    sample_id: str,
) -> dict[str, Any]:
    """Format analysis results to be returned by the API.

    :param storage: the storage backend
    :param mongo: the database object
    :param pg: the application PostgreSQL database object
    :param workflow: the analysis workflow used to dispatch formatting
    :param results: the results to format
    :param legacy_id: the legacy analysis id used to load offloaded results
    :param sample_id: the id of the parent sample used to load offloaded results
    :return: the formatted results

    """
    if workflow is None:
        raise ValueError("Analysis has no workflow field")

    if workflow == AnalysisWorkflow.nuvs.value:
        return await format_nuvs(
            storage,
            mongo,
            results=results,
            legacy_id=legacy_id,
            sample_id=sample_id,
        )

    if workflow == AnalysisWorkflow.aodp.value:
        return await format_aodp(mongo, pg, results=results)

    if "pathoscope" in workflow:
        return await format_pathoscope(
            storage,
            mongo,
            pg,
            results=results,
            legacy_id=legacy_id,
            sample_id=sample_id,
        )

    if workflow == AnalysisWorkflow.iimi.value:
        return results

    raise ValueError(f"Unknown workflow: {workflow}")


async def gather_patched_otus(
    mongo: "Mongo",
    pg: AsyncEngine,
    results: list[dict],
) -> dict[str, dict]:
    """Gather patched OTUs for each result item. Only fetch each id-version combination
    once.

    :param mongo: the database object
    :param pg: the application PostgreSQL database object
    :param results: the results field from a pathoscope analysis document
    :return: a dict containing patched OTUs keyed by the OTU ID

    """
    # Use set to only id-version combinations once.
    otu_specifiers = {(hit["otu"]["id"], hit["otu"]["version"]) for hit in results}

    patched_otus = await gather(
        *[
            patch_to_version(mongo, pg, otu_id, version)
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
