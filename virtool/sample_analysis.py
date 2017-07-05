import os
import virtool.blast

import virtool.utils
import virtool.virus
import virtool.virus_history
from virtool.sample import recalculate_algorithm_tags
from virtool.virus_index import get_current_index


LIST_PROJECTION = [
    "_id",
    "name",
    "algorithm",
    "timestamp",
    "ready",
    "job",
    "index_version",
    "user_id",
    "sample_id"
]


async def new(db, settings, manager, sample_id, user_id, algorithm):
    """
    Creates a new analysis. Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the requesting connection.

    """
    # Get the current id and version of the virus index currently being used for analysis.
    index_id, index_version = await get_current_index(db)

    data = {
        "sample_id": sample_id,
        "user_id": user_id,
        "algorithm": algorithm,
        "index_id": index_id
    }

    sample = await db.samples.find_one(sample_id, ["name"])

    analysis_id = await virtool.utils.get_new_id(db.analyses)

    job_id = await virtool.utils.get_new_id(db.jobs)

    document = dict(data)

    document.update({
        "_id": analysis_id,
        "job": job_id,
        "ready": False,
        "index_version": index_version,
        "timestamp": virtool.utils.timestamp()
    })

    task_args = dict(data, analysis_id=analysis_id, sample_name=sample["name"])

    await db.analyses.insert(document)

    # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
    # _id. This dictionary will be passed the the new analysis job.
    await manager.new(
        data["algorithm"],
        task_args,
        settings.get(data["algorithm"] + "_proc"),
        settings.get(data["algorithm"] + "_mem"),
        user_id,
        job_id=job_id
    )

    await recalculate_algorithm_tags(db, sample_id)

    return processor(document)


async def remove_by_id(db, settings, analysis_id):
    """
    Removes the analysis document identified by the id in ``data``.

    """
    # Get the sample id for the analysis
    sample = await db.analyses.find_one({"_id": analysis_id}, ["sample_id"])

    sample_id = sample["sample_id"]

    # Remove analysis entry from database
    await db.analyses.delete_one({"_id": analysis_id})

    # Remove the analysis directory
    path = os.path.join(settings.get("data_path"), "samples", "sample_{}".format(sample_id), "analysis", analysis_id)

    try:
        virtool.utils.rm(path, recursive=True)
    except FileNotFoundError:
        pass

    await recalculate_algorithm_tags(db, sample_id)


def initialize_blast(sequence):
    rid, rtoe = virtool.blast.initialize(sequence)

    return rid, rtoe


def retrieve_blast_result(rid):
    return virtool.blast.retrieve_result(rid)


def check_rid(rid):
    return virtool.blast.check_rid(rid)


async def format_analysis(db, analysis):

    isolate_fields = [
        "isolate_id",
        "default",
        "source_name",
        "source_type"
    ]

    sequence_fields = [
        "host",
        "definition"
    ]

    # Only included 'ready' analyses in the detail payload.
    if analysis["ready"] is True:
        if "pathoscope" in analysis["algorithm"]:
            # Holds viruses that have already been fetched from the database. If another isolate of a previously
            # fetched virus is found, there is no need for a round-trip back to the database.
            fetched_viruses = dict()

            found_isolates = list()

            annotated = dict()

            for accession, hit_document in analysis["diagnosis"].items():

                virus_id = hit_document["virus_id"]
                virus_version = hit_document["virus_version"]

                if virus_id not in fetched_viruses:
                    joined = await virtool.virus.join(db, virus_id)

                    # Get the virus entry (patched to correct version).
                    _, virus_document, _ = await virtool.virus_history.patch_virus_to_version(
                        db,
                        joined,
                        virus_version
                    )

                    fetched_viruses[virus_id] = virus_document

                    annotated[virus_id] = {
                        "_id": virus_id,
                        "name": virus_document["name"],
                        "abbreviation": virus_document["abbreviation"],
                        "isolates": dict(),
                        "ref_length": 0
                    }

                virus_document = fetched_viruses[virus_id]

                max_ref_length = 0

                for isolate in virus_document["isolates"]:

                    ref_length = 0

                    for sequence in isolate["sequences"]:
                        if sequence["_id"] == accession:
                            isolate_id = isolate["isolate_id"]

                            if isolate_id not in found_isolates:
                                reduced_isolate = {key: isolate[key] for key in isolate_fields}
                                reduced_isolate["hits"] = list()
                                annotated[virus_id]["isolates"][isolate_id] = reduced_isolate
                                found_isolates.append(isolate["isolate_id"])

                            hit = dict(hit_document)
                            hit.update({key: sequence[key] for key in sequence_fields})
                            hit["accession"] = accession

                            annotated[virus_id]["isolates"][isolate_id]["hits"].append(hit)

                            ref_length += len(sequence["sequence"])

                    if ref_length > max_ref_length:
                        max_ref_length = ref_length

                annotated[virus_id]["ref_length"] = max_ref_length

            analysis["diagnosis"] = [annotated[virus_id] for virus_id in annotated]

        if analysis["algorithm"] == "nuvs":
            for hmm_result in analysis["hmm"]:
                hmm = await db.hmm.find_one({"_id": hmm_result["hit"]}, [
                    "cluster",
                    "families",
                    "definition",
                    "label"
                ])

                hmm_result.update(hmm)

        return analysis
