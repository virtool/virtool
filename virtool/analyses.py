import os
import shutil
import logging
import tornado.gen

import virtool.gen
import virtool.job
import virtool.utils
import virtool.files
import virtool.plots
import virtool.blast
import virtool.database
import virtool.pathoscope

logger = logging.getLogger(__name__)


class Collection(virtool.database.Collection):
    """
    A connection to the pymongo analyses collection. Provides methods for viewing and modifying the
    collection.

    :param dispatcher: the dispatcher object that instantiated the collection.
    :type dispatcher: :class:`~.dispatcher.Dispatcher`

    """
    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("analyses", dispatch, collections, settings, add_periodic_callback)

        self.sync_projector += [
            "name",
            "algorithm",
            "sample_id",
            "index_version",
            "username",
            "timestamp"
        ]

    @virtool.gen.coroutine
    def new(self, sample_id, name, username, algorithm):
        """
        Creates a new analysis based on the data in ``transaction`` and starts a sample import job.

        Adds the imported files to the :attr:`.excluded_files` list so that they will not be imported again. Ensures
        that a valid subtraction host was the submitted. Configures read and write permissions on the sample document
        and assigns it a creator username based on the connection attached to the transaction.

        """
        # Get the current id and version of the virus index currently being used for analysis.
        index_id, index_version = yield self.collections["indexes"].get_current_index()

        data = {
            "sample_id": sample_id,
            "name": name,
            "username": username,
            "algorithm": algorithm,
            "index_id": index_id
        }

        analysis_id = yield self.get_new_id()

        job_id = yield self.collections["jobs"].get_new_id()

        document = dict(data)

        document.update({
            "_id": analysis_id,
            "job": job_id,
            "ready": False,
            "index_version": index_version,
            "timestamp": virtool.utils.timestamp()
        })

        task_args = dict(data)

        task_args["analysis_id"] = analysis_id

        yield self.insert(document)

        # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
        # _id. This dictionary will be passed the the new analysis job.
        yield self.collections["jobs"].new(
            data["algorithm"],
            task_args,
            self.settings.get(data["algorithm"] + "_proc"),
            self.settings.get(data["algorithm"] + "_mem"),
            username,
            job_id=job_id
        )

    @virtool.gen.coroutine
    def set_analysis(self, data):
        """
        Update the analysis document identified using ``data``, which contains the analysis id and the update. Sets the
        analysis' ``ready`` field to ``True``. Sets the parent sample's ``analyzed`` field to ``True`` and increments
        its version by one.

        This method is called from within an analysis job.

        :param data: the data used to perform the update
        :type data: dict

        """
        data["analysis"]["ready"] = True

        yield self.update({"_id": data["analysis_id"]}, {
            "$set": data["analysis"]
        })

    @virtool.gen.exposed_method([])
    def blast_nuvs_sequence(self, transaction):
        """
        BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST data will be attached to that
        sequence.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        """
        analysis_id = transaction.data["_id"]
        sequence_index = transaction.data["sequence_index"]

        minimal_analysis = yield self.find_one({"_id": analysis_id}, {
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

    @virtool.gen.exposed_method([])
    def remove_analysis(self, transaction):
        """
        An exposed method that wraps :meth:`.remove_by_id`.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating the success of the operation and the response from the Mongo remove operation.
        :rtype: tuple

        """
        id_list = virtool.database.coerce_list(transaction.data["_id"])

        for _id in id_list:
            yield self.remove_by_id(_id)

        return True, None

    @virtool.gen.coroutine
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

        shutil.rmtree(path)

        try:
            yield virtool.utils.rm(path, recursive=True)
        except FileNotFoundError:
            pass

        return response

    @virtool.gen.coroutine
    def remove_by_sample_id(self, id_list):
        """
        Removes the analysis documents and files associated with the passed sample_id. The files on disk are **not**
        removed.

        :param id_list: a single _id or list of _ids of samples to remove all analyses for.
        :type id_list: str or list

        """
        # Make sure we are working with a list of sample ids.
        id_list = virtool.database.coerce_list(id_list)

        # Remove analysis documents from database.
        yield self.remove({
            "sample": {
                "$in": id_list
            }
        })

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        detail = yield self.get_by_id(transaction.data["_id"])

        return True, detail

    @virtool.gen.coroutine
    def get_by_id(self, id_list):
        virtool.database.coerce_list(id_list)

        analyses = yield self.find({
            "_id": {
                "$in": id_list
            }
        }).to_list(None)

        analyses = yield self.format(analyses)

        return analyses

    @virtool.gen.coroutine
    def format(self, analyses):
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


@virtool.gen.synchronous
def initialize_blast(sequence):
    rid, rtoe = virtool.blast.initialize(sequence)

    return rid, rtoe


@virtool.gen.synchronous
def retrieve_blast_result(rid):
    return virtool.blast.retrieve_result(rid)


@virtool.gen.synchronous
def check_rid(rid):
    return virtool.blast.check_rid(rid)

