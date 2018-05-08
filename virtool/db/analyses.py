import aiofiles
import json

import virtool.analyses
import virtool.bio
import virtool.db.history
import virtool.db.indexes
import virtool.db.samples
import virtool.db.utils
import virtool.utils

PROJECTION = [
    "_id",
    "algorithm",
    "created_at",
    "ready",
    "job",
    "index",
    "user",
    "sample"
]


async def format_analysis(db, settings, document):
    """
    Format an analysis document to be returned by the API.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param document: the analysis document to format
    :type document: dict

    :return: a formatted document
    :rtype: dict

    """
    algorithm = document.get("algorithm", None)

    if algorithm == "nuvs":
        return await format_nuvs(db, settings, document)

    if algorithm == "pathoscope":
        return await format_pathoscope(db, document)

    raise ValueError("Could not determine analysis algorithm")


async def format_nuvs(db, settings, document):
    if document["results"] == "file":
        path = virtool.analyses.get_nuvs_json_path(settings.get("data_path"), document["_id"], document["sample"]["id"])

        async with aiofiles.open(path, "r") as f:
            json_string = await f.read()
            document["results"] = dict(document, results=json.loads(json_string))

    for sequence in document["results"]:
        for orf in sequence["orfs"]:
            for hit in orf["hits"]:
                hmm = await db.hmm.find_one({"_id": hit["hit"]}, [
                    "cluster",
                    "families",
                    "names"
                ])

                hit.update(hmm)

    return document


async def format_pathoscope(db, document):
    formatted = dict()

    for hit in document["diagnosis"]:

        otu_id = hit["otu"]["id"]
        version = hit["otu"]["version"]

        otu = formatted.get(otu_id, None)

        if otu is None:
            # Get the otu entry (patched to correct version).
            _, otu_document, _ = await virtool.db.history.patch_to_version(
                db,
                otu_id,
                version
            )

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

    document["diagnosis"] = [formatted[otu_id] for otu_id in formatted]

    for otu in document["diagnosis"]:
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
                    coordinates = virtool.analyses.coverage_to_coordinates(sequence["align"])
                    sequence["align"] = virtool.analyses.smooth_coverage_coordinates(coordinates, tolerance=0.05)

                del sequence["sequence"]

    return document


async def new(db, manager, sample_id, ref_id, user_id, algorithm):
    """
    Creates a new analysis. Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the requesting connection.

    """
    # Get the current id and version of the otu index currently being used for analysis.
    index_id, index_version = await virtool.db.indexes.get_current_id_and_version(db, ref_id)

    sample = await db.samples.find_one(sample_id, ["name"])

    analysis_id = await virtool.db.utils.get_new_id(db.analyses)

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    document = {
        "_id": analysis_id,
        "ready": False,
        "created_at": virtool.utils.timestamp(),
        "job": {
            "id": job_id
        },
        "algorithm": algorithm,
        "sample": {
            "id": sample_id
        },
        "index": {
            "id": index_id,
            "version": index_version
        },
        "ref": {
            "id": ref_id
        },
        "user": {
            "id": user_id,
        }
    }

    task_args = {
        "analysis_id": analysis_id,
        "ref_id": ref_id,
        "sample_id": sample_id,
        "sample_name": sample["name"],
        "index_id": index_id
    }

    if "pathoscope" in algorithm:
        sequence_otu_map = dict()
        otu_dict = dict()

        async for sequence_document in db.sequences.find({}, ["otu_id", "isolate_id"]):
            otu_id = sequence_document["otu_id"]

            otu = otu_dict.get(otu_id, None)

            if otu is None:
                otu = await db.otus.find_one(otu_id, ["last_indexed_version"])

                try:
                    last_index_version = otu["last_indexed_version"]

                    otu_dict[otu["_id"]] = {
                        "id": otu["_id"],
                        "version": last_index_version
                    }

                    sequence_otu_map[sequence_document["_id"]] = otu_id
                except KeyError:
                    otu_dict[otu["id"]] = False

            sequence_otu_map[sequence_document["_id"]] = otu_id

        sequence_otu_map = [item for item in sequence_otu_map.items()]

        task_args.update({
            "otu_dict": otu_dict,
            "sequence_otu_map": sequence_otu_map
        })

    await db.analyses.insert_one(document)

    # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
    # _id. This dictionary will be passed the the new analysis job.
    await manager.new(
        document["algorithm"],
        task_args,
        user_id,
        job_id=job_id
    )

    await virtool.db.samples.recalculate_algorithm_tags(db, sample_id)

    return document


async def update_nuvs_blast(db, settings, analysis_id, sequence_index, rid):
    """
    Update the BLAST data for a sequence in a NuVs analysis.

    :param db:

    :param analysis_id:
    :param sequence_index:
    :param rid:

    :return: the blast data and the complete analysis document
    :rtype: Tuple[dict, dict]

    """
    # Do initial check of RID to populate BLAST embedded document.
    data = {
        "rid": rid,
        "ready": await virtool.bio.check_rid(settings, rid),
        "last_checked_at": virtool.utils.timestamp(),
        "interval": 3
    }

    document = await db.analyses.find_one_and_update({"_id": analysis_id, "results.index": sequence_index}, {
        "$set": {
            "results.$.blast": data
        }
    })

    return data, document
