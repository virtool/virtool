"""
Functions and data to use for formatting Pathoscope and NuVs analysis document. Formatted documents are destined for
API responses or CSV/Excel formatted file downloads.

"""
import asyncio
import csv
import io
import json
import statistics

import aiofiles
import openpyxl.styles

import virtool.analyses.db
import virtool.analyses.utils
import virtool.db.core
import virtool.history.db
import virtool.otus.utils

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


async def format_pathoscope(app, document):
    document = await load_results(
        app["settings"],
        document
    )

    formatted = dict()

    otu_specifiers = {(hit["otu"]["id"], hit["otu"]["version"]) for hit in document["results"]}

    patched_otus = await asyncio.gather(*[
        virtool.history.db.patch_to_version(
            app,
            otu_id,
            version
        ) for otu_id, version in otu_specifiers
    ])

    patched_otus = {patched["_id"]: patched for _, patched, _ in patched_otus}

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

                if "align" in sequence:
                    sequence["align"] = virtool.analyses.utils.transform_coverage_to_coordinates(sequence["align"])

                del sequence["sequence"]

    return document


async def format_nuvs(app, document):
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


async def format_analysis_to_excel(app, document):
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


async def format_analysis_to_csv(app, document):
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


async def format_analysis(app, document: dict) -> dict:
    """
    Format an analysis document to be returned by the API.

    :param app: the application object
    :param document: the analysis document to format
    :return: a formatted document

    """
    db = app["db"]
    settings = app["settings"]

    algorithm = document.get("algorithm")

    if algorithm == "nuvs":
        return await format_nuvs(app, document)

    if algorithm and "pathoscope" in algorithm:
        return await format_pathoscope(app, document)

    raise ValueError("Could not determine analysis algorithm")


