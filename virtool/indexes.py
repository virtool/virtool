import os
import dictdiffer
import collections
import logging

import virtool.gen
import virtool.database
import virtool.utils
import virtool.job
import virtool.viruses

logger = logging.getLogger(__name__)


class Collection(virtool.database.Collection):

    """
    An :class:`.virtool.database.Collection` interface for the *indexes* MongoDB collection. Allows interaction of virus
    reference index versions. There are no *exposed methods* in this class. Some methods from
    :class:`.virtool.viruses.Collection` should probably be moved to this class.

    :param dispatcher: the dispatcher that instantiated the :class:`.indexes.Collection` object.
    :type dispatcher: :class:`.Dispatcher`

    """
    def __init__(self, dispatcher):
        super(Collection, self).__init__("indexes", dispatcher)

        self.sync_projector.update({key: True for key in [
            "timestamp",
            "virus_count",
            "modification_count",
            "modified_virus_count",
            "username",
            "index_version",
            "ready",
            "has_files"
        ]})

    @virtool.gen.exposed_method(["rebuild_index"])
    def rebuild(self, transaction):
        """
        Starts a job to rebuild the viruses Bowtie2 index on disk. Does a check to make sure there are no unverified
        viruses in the collection and updates virus history to show the version and id of the new index.

        :param transaction: the Transaction object generated from the client request.
        :type transaction: :type transaction: :class:`~.dispatcher.Transaction`

        :return: a tuple containing a bool indicating success and a dict indicating the number of unverified viruses.
        :rtype: tuple

        """
        # Check if any viruses are unverified.
        unverified_virus_count = yield self.dispatcher.collections["viruses"].find({"modified": True}).count()

        user = transaction.connection.user

        if unverified_virus_count == 0:
            index_version = yield self.get_current_index_version()

            index_version += 1

            index_id = yield self.get_new_id()

            yield self.insert({
                "_id": index_id,
                "index_version": index_version,
                "timestamp": virtool.utils.timestamp(),
                "ready": False,
                "has_files": True,
                "username": user["_id"],
                "virus_count": None,
                "modification_count": None,
                "modified_virus_count": None,
                "_version": 0
            })

            # Update all history entries with no index_version to the new index version.
            yield self.dispatcher.collections["history"].update({"index": "unbuilt"}, {
                "$set": {
                    "index": index_id,
                    "index_version": index_version
                }
            })

            # Generate a dict of virus document version numbers keyed by the document id.
            virus_manifest = dict()

            virus_cursor = self.dispatcher.collections["viruses"].find()

            while (yield virus_cursor.fetch_next):
                virus = virus_cursor.next_object()
                virus_manifest[virus["_id"]] = virus["_version"]

            # A dict of task_args for the rebuild job.
            task_args = {
                "username": user["_id"],
                "index_id": index_id,
                "index_version": index_version,
                "virus_manifest": virus_manifest
            }

            # Start the job.
            yield self.dispatcher.collections["jobs"].new("rebuild", task_args, 1, 2, user["_id"])

            return True, None

        return False, {"unverified_virus_count": unverified_virus_count}

    @virtool.gen.coroutine
    def get_current_index_version(self):
        """
        Get the current (latest) index version number.

        :return: current index version.
        :rtype: int

        """
        index_count = yield self.find({"ready": True}).count()

        assert index_count > -1

        # Index versions start at 0. Return -1 if no indexes exist.
        return index_count - 1

    @virtool.gen.coroutine
    def get_current_index(self):
        """
        Return the current index id and version number.

        :return: the current index id and version number.
        :rtype: tuple

        """
        current_index_version = yield self.get_current_index_version()

        if current_index_version == -1:
            return None

        index_id = yield self.get_field({"index_version": current_index_version}, "_id")

        return index_id, current_index_version

    @virtool.gen.coroutine
    def set_stats(self, data):
        """
        Updates the index document with data describing the changes made to the virus reference since the last index
        build:

        * modification_count - the number of changes recorded since the last index build.
        * modified_virus_count - The number of viruses modified since the last index build.
        * virus_count - Number of viruses now present in the viruses collection.

        :param data: the three-key dict containing the index data.
        :type data: dict
        :return: the response from the Mongo insert operation.
        :rtype: dict

        """
        response = yield self.update(data["_id"], {"$set": data})

        return response

    @virtool.gen.coroutine
    def set_ready(self, data):
        """
        Updates the index document described by the passed index id to show whether it is ready or not.

        :param data: a dict containing a index id and a *ready* key indicating whether the index is ready to be used.
        :type data: dict
        :return: the response from the Mongo update operation.
        :rtype: dict

        """
        response = yield self.update(data["_id"], {"$set": {"ready": data["ready"]}})

        return response

    @virtool.gen.coroutine
    def cleanup_index_files(self):
        """
        Cleans up unused index dirs. Only the **active** index (latest ready index) is ever available for running
        analysis from the web client. Any older indexes are removed from disk. If a running analysis still needs an old
        index, it cannot be removed.

        This method removes old index dirs while ensuring to retain old ones that are still references by pending
        analyses.

        """
        aggregation_cursor = self.dispatcher.collections["samples"].analyses_collection.aggregate([
            {"$match": {"ready": False}},
            {"$group": {"_id": "$index_id"}}
        ])

        # The indexes (_ids) currently in use by running analysis jobs.
        active_indexes = list()

        while (yield aggregation_cursor.fetch_next):
            active_indexes.append(aggregation_cursor.next_object()["_id"])

        # The newest index version.
        current_index_id, _ = yield self.get_current_index()
        active_indexes.append(current_index_id)

        # Any rebuilding index
        unready_index = yield self.find_one({"ready": False})

        if unready_index:
            active_indexes.append(unready_index["_id"])

        try:
            active_indexes.remove("unbuilt")
        except ValueError:
            pass

        active_indexes = list(set(active_indexes))

        yield self.update({"_id": {"$in": active_indexes}}, {"$set": {"has_files": False}})

        base_path = os.path.join(self.settings.get("data_path"), "reference/viruses")

        for dir_name in os.listdir(base_path):
            if dir_name not in active_indexes:
                try:
                    yield virtool.utils.rm(os.path.join(base_path, dir_name), recursive=True)
                except OSError:
                    pass


class Rebuild(virtool.job.Job):
    """
    Job object that rebuilds the viral Bowtie2 index from the viral sequence database. Job stages are:

    1. mk_index_dir
    2. write_fasta
    3. bowtie_build
    4. replace_old


    """
    def __init__(self, *args, **kwargs):
        super(Rebuild, self).__init__(*args, **kwargs)

        self.stage_list = [
            self.mk_index_dir,
            self.write_fasta,
            self.bowtie_build,
            self.replace_old
        ]

        self.index_id = self.task_args["index_id"]

        self.reference_path = os.path.join(self.settings["data_path"], "reference/viruses", self.index_id)

        self.database = virtool.utils.get_db_client(self.settings, sync=True)

    def get_joined_virus(self, virus_id):
        """
        Retrieve from the database the virus document associated with the passed virus_id. Then, join the virus with its
        associated sequence documents and return it.

        :param virus_id: the virus_id for which to get a joined virus.
        :type virus_id: str
        :return: the joined virus document and list of sequence documents.
        :rtype: tuple

        """
        virus = self.database.viruses.find_one({"_id": virus_id})

        if virus is None:
            return None

        # Extract the isolate_ids associated with the virus.
        isolate_ids = [isolate["isolate_id"] for isolate in virus["isolates"]]

        # Get the sequence entries associated with the isolate ids.
        sequences = list(self.database.sequences.find({"isolate_id": {"$in": isolate_ids}}))

        # Merge the sequence entries into the virus entry.
        joined = virtool.viruses.merge_virus(virus, sequences)

        return joined, sequences

    def patch_virus_to_version(self, current_joined, target_version):
        """
        Patch a joined virus document to its form a specific version number.

        :param current_joined: the current joined virus document.
        :type current_joined: dict
        :param target_version: the version to patch the passed joined virus document back to.
        :type target_version: str
        :return: a joined virus document patched back to the target version.
        :rtype: dict

        """
        virus_history = self.database.history.find({"entry_id": current_joined["_id"]})

        # Sort the changes be descending entry version.
        history_documents = sorted(virus_history, key=lambda x: x["timestamp"], reverse=True)

        patched = dict(current_joined)

        if patched["_version"] != target_version:
            for history_document in history_documents:
                entry_version = history_document["entry_version"]

                if entry_version == "removed" or entry_version >= target_version:
                    if history_document["method_name"] == "add":
                        patched = "remove"

                    elif history_document["method_name"] == "remove":
                        patched = history_document["changes"]
                        break

                    else:
                        diff = dictdiffer.swap(history_document["changes"])
                        patched = dictdiffer.patch(diff, patched)
                else:
                    break

        return patched

    def mk_index_dir(self):
        """
        Make dir for the new index at ``<data_path/reference/viruses/<index_id>``.

        """
        os.mkdir(self.reference_path)

    def write_fasta(self):
        """
        Generates a FASTA file of all sequences in the reference database. The FASTA headers are
        the accession numbers. These can be used to refer to full reference descriptions in the
        database after RSEM analysis and parsing

        """
        fasta_dict = dict()

        modified_virus_count = 0

        total_found_sequences = 0

        modification_count = self.database.history.find({"index": self.index_id}).count()

        for virus_id, virus_version in self.task_args["virus_manifest"].items():
            current, sequences = self.get_joined_virus(virus_id) or dict()

            # A the virus joined at the correct version.
            patched = self.patch_virus_to_version(current, virus_version)

            last_indexed_version = patched["last_indexed_version"]

            if (last_indexed_version and last_indexed_version != virus_version) or last_indexed_version is None:
                modified_virus_count += 1

            # Extract the list of sequences from the joined patched virus.
            sequences = get_default_sequences(patched)

            assert len(sequences) > 0

            total_found_sequences += len(sequences)

            defaults = list()

            for sequence in sequences:
                defaults.append(sequence["_id"])
                fasta_dict[sequence["_id"]] = sequence["sequence"]

        total_written_headers = 0

        # Open a new FASTA file for writing the new reference collection
        with open(os.path.join(self.reference_path, "ref.fa"), "w") as output:
            for _id, sequence in fasta_dict.items():
                sequence = "".join(sequence)
                sequence = "".join(sequence.split())
                output.write(">" + _id + "\n" + sequence + "\n")
                total_written_headers += 1

        self.collection_operation("indexes", "set_stats", {
            "_id": self.index_id,
            "virus_count": len(self.task_args["virus_manifest"]),
            "modified_virus_count": modified_virus_count,
            "modification_count": modification_count
        })

    def bowtie_build(self):
        """
        Run a standard bowtie-build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        command = [
            "bowtie2-build",
            "-f",
            os.path.join(self.reference_path, "ref.fa"),
            os.path.join(self.reference_path, "reference")
        ]

        self.run_process(command)

    def replace_old(self):
        """
        Replaces the old index with the newly generated one.

        First sets the index document field *set_ready* to `True` so the web interface will no longer show the index
        as building. Then update the *last_indexed_version* field for all virus documents. Finally, invoke
        :meth:`.job.Job.collection_operation` to call :meth:`.Collection.cleanup_index_files`. This removes any
        indexes not referred to by active sample analyses.

        """
        # Tell the client the index is ready to be used and to no longer show it as building.
        self.collection_operation("indexes", "set_ready", {
            "_id": self.index_id,
            "ready": True
        })

        by_version = collections.defaultdict(list)

        for virus_id, virus_version in self.task_args["virus_manifest"].items():
            by_version[virus_version].append(virus_id)

        for version, virus_ids in by_version.items():
            self.collection_operation("viruses", "set_last_indexed_version", {
                "version": version,
                "ids": virus_ids
            })

        self.collection_operation("indexes", "cleanup_index_files")

    def cleanup(self):
        """
        Cleanup if the job fails. Removes the nascent index document and change the *index_id* and *index_version*
        fields all history items being included in the new index to be 'unbuilt'.

        """
        self.collection_operation("indexes", "remove", {"_id": self.index_id})

        self.collection_operation("history", "set_index_as_unbuilt", {
            "index_id": self.index_id,
            "index_version": self.task_args["index_version"]
        })


def get_default_sequences(joined_document):
    """
    Return a list of sequences from the default isolate of the passed joined virus document.

    :param joined_document: the joined virus document.
    :type joined_document: dict
    :return: a list of sequences associated with the default isolate.
    :rtype: list

    """
    for isolate in joined_document["isolates"]:
        if isolate["default"]:
            return isolate["sequences"]
