import os

from virtool.utils import timestamp, rm
from virtool.data.utils import get_new_id, coerce_list
from virtool.data.samples import recalculate_algorithm_tags
from virtool.data.indexes import get_current_index


projector = [
    "_id",
    "_version",
    "name",
    "algorithm",
    "sample_id",
    "index_version",
    "username",
    "timestamp"
]


async def new(db, settings, sample_id, name, user_id, algorithm):
    """
    Creates a new analysis. Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the requesting connection.

    """
    # Get the current id and version of the virus index currently being used for analysis.
    index_id, index_version = await get_current_index(db)

    data = {
        "sample_id": sample_id,
        "name": name,
        "user_id": user_id,
        "algorithm": algorithm,
        "index_id": index_id
    }

    analysis_id = await get_new_id(db.analyses)

    job_id = await get_new_id(db.jobs)

    document = dict(data)

    document.update({
        "_id": analysis_id,
        "job": job_id,
        "ready": False,
        "index_version": index_version,
        "timestamp": timestamp()
    })

    task_args = dict(data)

    task_args["analysis_id"] = analysis_id

    await db.analyses.insert(document)

    # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
    # _id. This dictionary will be passed the the new analysis job.
    await db.jobs.new(
        data["algorithm"],
        task_args,
        settings.get(data["algorithm"] + "_proc"),
        settings.get(data["algorithm"] + "_mem"),
        user_id,
        job_id=job_id
    )

    await recalculate_algorithm_tags(db, sample_id)


def remove_by_id(self, analysis_id):
    """
    Removes the analysis document identified by the id in ``data``.

    :param analysis_id: the id of the analysis document to remove.
    :type analysis_id: str

    """
    # Get the sample id for the analysis
    minimal_analysis = yield self.find_one({"_id": analysis_id}, {"sample_id": True})

    sample_id = minimal_analysis["sample_id"]

    # Remove analysis entry from database
    response = yield self.remove(analysis_id)

    # Remove the analysis directory
    path = os.path.join(self.settings.get("data_path"), "samples/sample_" + sample_id, "analysis", analysis_id)

    try:
        yield rm(path, recursive=True)
    except FileNotFoundError:
        pass

    yield self.collections["samples"].recalculate_algorithm_tags(sample_id)

    return response


async def remove_by_sample_id(db, sample_id_list):
    """
    Removes the analysis documents and files associated with the passed sample_id. The files on disk are **not**
    removed.

    """
    # Make sure we are working with a list of sample ids.
    id_list = coerce_list(sample_id_list)

    # Remove analysis documents from database.
    await db.analyses.remove({
        "sample_id": {
            "$in": sample_id_list
        }
    })

    for sample_id in id_list:
        await db.samples.recalculate_algorithm_tags(sample_id)


async def blast_nuvs_sequence(db, analysis_id, sequence_index):
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
    sequence.

    """

    minimal_analysis = await db.analyses.find_one({"_id": analysis_id}, {
        "sample": True,
        "sequences": True
    })

    sequences = [sequence for sequence in minimal_analysis["sequences"] if sequence["index"] == int(sequence_index)]

    assert len(sequences) == 1

    nuc = sequences[0]["sequence"]

    rid, _ = yield initialize_blast(nuc)

    ready = False
    checked = False
    interval = 3

    while not ready:

        yield self.update({"_id": analysis_id, "sequences.index": sequence_index}, {
            "$set": {
                "sequences.$.blast": {
                    "rid": rid,
                    "ready": ready,
                    "checked": checked,
                    "interval": interval
                }
            }
        })

        yield tornado.gen.sleep(interval)

        ready = yield check_rid(rid)

        interval += 3

    result = yield retrieve_blast_result(rid)

    result.update({
        "rid": rid,
        "ready": ready,
        "checked": checked,
        "interval": interval
    })

    print(result)

    response = yield self.update({"_id": analysis_id, "sequences.index": sequence_index}, {
        "$set": {
            "sequences.$.blast": result
        }
    })

    return True, response


def initialize_blast(sequence):
    rid, rtoe = virtool.blast.initialize(sequence)

    return rid, rtoe


def retrieve_blast_result(rid):
    return virtool.blast.retrieve_result(rid)


def check_rid(rid):
    return virtool.blast.check_rid(rid)


async def format_analyses(db, analyses):

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

    for analysis in analyses:
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
                        # Get the virus entry (patched to correct version).
                        _, virus_document, _ = yield self.collections["history"].get_versioned_document(
                            virus_id,
                            virus_version + 1
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
                    hmm = yield self.collections["hmm"].find_one({"_id": hmm_result["hit"]}, {
                        "cluster": True,
                        "families": True,
                        "definition": True,
                        "label": True
                    })

                    hmm_result.update(hmm)

    return analyses