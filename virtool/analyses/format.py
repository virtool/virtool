"""
Functions and data to use for formatting Pathoscope and NuVs analysis document. Formatted documents are destined for
API responses or CSV/Excel formatted file downloads.

"""
import asyncio
import csv
import io
import json
import statistics
from collections import defaultdict

import aiofiles
import openpyxl.styles

import virtool.analyses.db
import virtool.analyses.utils
import virtool.db.core
import virtool.db.utils
import virtool.history.db
import virtool.otus.db
import virtool.otus.utils
import virtool.types

CSV_HEADERS = (
    "OTU",
    "Isolate",
    "Sequence",
    "Length",
    "Weight",
    "Median Depth",
    "Coverage"
)


def calculate_median_depths(document: dict) -> dict:
    """
    Calculate the median depth for all hits (sequences) in a Pathoscope result document.

    :param document: the pathoscope analysis document to calculate depths for
    :return: a dict of median depths keyed by hit (sequence) ids

    """
    depths = dict()

    for hit in document["results"]:
        depths[hit["id"]] = statistics.median(hit["align"])

    return depths


async def create_pathoscope_coverage_cache(db, document: dict) -> dict:
    """
    Create a pathoscope coverage cache document. This saves the costly recalculation of coverage chart coordinates from
    raw coverage arrays each time the analysis is retrieved.

    :param db: the application database object
    :param document: the analysis document to create cache for
    :return: the coverage cache document

    """
    cache = defaultdict(lambda: defaultdict(lambda: dict()))

    for hit in document["results"]:
        for isolate in hit["isolates"]:
            for sequence in isolate["sequences"]:
                otu_id = hit["id"]
                isolate_id = isolate["id"]
                sequence_id = sequence["id"]

                if sequence.get("align"):
                    cache[otu_id][isolate_id][sequence_id] = virtool.analyses.utils.transform_coverage_to_coordinates(sequence["align"])

    document = {
        "analysis": {
            "id": document["_id"]
        },
        "cache": cache
    }

    await db.coverage.insert_one(document)

    return document


async def ensure_pathoscope_coverage_cache(db, document: dict):
    """
    Attach coverage values to the passed document. Either retrieve an existing coverage cache document or generate a one
    if one doesn't exist.

    :param db: the application database object
    :param document: the analysis document
    :return: the analysis document with coverage attached

    """
    cache = await db.coverage.find_one({"analysis.id": document["_id"]})

    if cache is None:
        cache = await create_pathoscope_coverage_cache(db, document)

    for hit in document["results"]:
        for isolate in hit["isolates"]:
            for sequence in isolate["sequences"]:
                otu_id = hit["id"]
                isolate_id = isolate["id"]
                sequence_id = sequence["id"]

                if sequence.get("align"):
                    sequence["align"] = cache["cache"][otu_id][isolate_id][sequence_id]


async def load_results(settings: dict, document: dict) -> dict:
    """
    Load the analysis results. Hide the alternative loading from a `results.json` file. These files are only
    generated if the analysis data would have exceeded the MongoDB size limit (16mb).

    The document is returned unmodified if loading from file is not required.

    :param settings: the application settings
    :param document: the document to load results for
    :return: a complete analysis document

    """
    if document["results"] == "file":
        path = virtool.analyses.utils.join_analysis_json_path(
            settings["data_path"],
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


async def format_aodp(app: virtool.types.App, document):
    """
    Format an AODP analysis document by retrieving the detected OTUs and incorporating them into the returned document.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document
    
    """
    patched_otus = await gather_patched_otus(app, document["results"])

    hits = defaultdict(list)

    for hit in document["results"]:
        hits[hit["sequence_id"]].append(hit)

    for otu in patched_otus.values():
        otu["id"] = otu.pop("_id")

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence["hits"] = hits[sequence["_id"]]
                sequence["id"] = sequence.pop("_id")

    return {
        **document,
        "results": list(patched_otus.values())
    }


async def format_pathoscope(app: virtool.types.App, document: dict) -> dict:
    """
    Format a Pathoscope analysis document by retrieving the detected OTUs and incorporating them into the returned
    document. Calculate metrics for different organizational levels: OTU, isolate, sequence.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(
        app["settings"],
        document
    )

    patched_otus = await gather_patched_otus(app, document["results"])

    formatted = dict()

    for hit in document["results"]:

        otu_id = hit["otu"]["id"]

        otu_document = patched_otus[otu_id]

        max_ref_length = 0

        for isolate in otu_document["isolates"]:
            max_ref_length = max(max_ref_length, max([len(s["sequence"]) for s in isolate["sequences"]]))

        otu = {
            "id": otu_id,
            "name": otu_document["name"],
            "version": otu_document["version"],
            "abbreviation": otu_document["abbreviation"],
            "isolates": otu_document["isolates"],
            "length": max_ref_length
        }

        formatted[otu_id] = otu

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                if sequence["_id"] == hit["id"]:
                    sequence.update(hit)
                    sequence["length"] = len(sequence["sequence"])

                    del sequence["otu"]
                    del sequence["otu_id"]
                    del sequence["isolate_id"]

    document["results"] = [formatted[otu_id] for otu_id in formatted]

    for otu in document["results"]:
        for isolate in list(otu["isolates"]):
            if not any((key in sequence for sequence in isolate["sequences"]) for key in ("pi", "final")):
                otu["isolates"].remove(isolate)
                continue

            for sequence in isolate["sequences"]:
                if "final" in sequence:
                    sequence.update(sequence.pop("final"))
                    del sequence["initial"]
                if "pi" not in sequence:
                    sequence.update({
                        "pi": 0,
                        "reads": 0,
                        "coverage": 0,
                        "best": 0,
                        "length": len(sequence["sequence"])
                    })

                sequence["id"] = sequence.pop("_id")
                del sequence["sequence"]

    await ensure_pathoscope_coverage_cache(app["db"], document)

    return document


async def format_nuvs(app: virtool.types.App, document: dict) -> dict:
    """
    Format a NuVs analysis document by attaching the HMM annotation data to the results.

    :param app: the application object
    :param document: the document to format
    :return: the formatted document

    """
    document = await load_results(
        app["settings"],
        document
    )

    hit_ids = list({h["hit"] for s in document["results"] for o in s["orfs"] for h in o["hits"]})

    cursor = app["db"].hmm.find({"_id": {"$in": hit_ids}}, ["cluster", "families", "names"])

    hmms = {d.pop("_id"): d async for d in cursor}

    for sequence in document["results"]:
        for orf in sequence["orfs"]:
            for hit in orf["hits"]:
                hit.update(hmms[hit["hit"]])

    return document


async def format_analysis_to_excel(app: virtool.types.App, document: dict) -> bytes:
    """
    Convert a pathoscope analysis document to byte-encoded Excel format for download.

    :param app: the application object
    :param document: the document to format
    :return: the formatted Excel workbook

    """
    depths = calculate_median_depths(document)

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
                    virtool.otus.utils.format_isolate_name(isolate),
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


async def format_analysis_to_csv(app: virtool.types.App, document: dict) -> str:
    """
    Convert a pathoscope analysis document to CSV format for download.

    :param app: the application object
    :param document: the document to format
    :return: the formatted CSV data

    """
    depths = calculate_median_depths(document)

    formatted = await format_analysis(app, document)

    output = io.StringIO()

    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)

    writer.writerow(CSV_HEADERS)

    for otu in formatted["results"]:
        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                row = [
                    otu["name"],
                    virtool.otus.utils.format_isolate_name(isolate),
                    sequence["accession"],
                    sequence["length"],
                    sequence["pi"],
                    depths.get(sequence["id"], 0),
                    sequence["coverage"]
                ]

                writer.writerow(row)

    return output.getvalue()


async def format_analysis(app: virtool.types.App, document: dict) -> dict:
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


async def gather_patched_otus(app: virtool.types.App, results: list) -> dict:
    """
    Gather patched OTUs for each result item. Only fetch each id-version combination once. Make database requests
    concurrently to save time.

    :param app: the application object
    :param results: the results field from a pathoscope analysis document
    :return: a dict containing patched OTUs keyed by the OTU ID

    """
    # Use set to only id-version combinations once.
    otu_specifiers = {(hit["otu"]["id"], hit["otu"]["version"]) for hit in results}

    patched_otus = await asyncio.gather(*[
        virtool.history.db.patch_to_version(
            app,
            otu_id,
            version
        ) for otu_id, version in otu_specifiers
    ])

    return {patched["_id"]: patched for _, patched, _ in patched_otus}
