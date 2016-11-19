import os
import shutil
import subprocess
import random
import pymongo

import virtool.utils
import virtool.files
import virtool.plots
import virtool.gen
import virtool.database
import virtool.job
import virtool.pathoscope


class Collection(virtool.database.SyncingCollection):
    """
    A connection to the pymongo samples collection. Provides methods for viewing and modifying the
    collection.

    :param dispatcher: the dispatcher object that instantiated the collection.
    :type dispatcher: :class:`~.dispatcher.Dispatcher`

    """
    def __init__(self, dispatcher):
        super().__init__("samples", dispatcher)

        dispatcher.watcher.register("reads", self.watch)

        # Extend sync_projector. These fields will be passed to the client to populate sample tables.
        self.sync_projector.update({field: True for field in [
            "name",
            "added",
            "username",
            "imported",
            "archived",
            "analyzed",
            "group",
            "group_read",
            "group_write",
            "all_read",
            "all_write"
        ]})

        #: A list of read files that are being imported and should not be shown as available for import.
        self.excluded_files = list()

        # A synchronous connection to the Mongo database.
        db_sync = virtool.utils.get_db_client(self.settings, sync=True)

        quality_updates = list()

        for document in db_sync.samples.find({"quality.left": {"$exists": True}}):
            # The quality data for the left side. Should be in every sample. It is the only side in single end
            # libraries.
            left = document["quality"]["left"]

            # The quality data for the right side. Only present for paired-end libraries.
            right = document["quality"].get("right", None)

            # We will make a quality dict describing one or both sides instead of each separately. Encoding is the same
            # for both sides.
            quality = {
                "encoding": left["encoding"].rstrip(),
                "count": left["count"],
                "length": left["length"],
                "gc": left["gc"]
            }

            # If a right side is present, sum the read counts and average the GC contents.
            if right:
                quality["count"] += right["count"]
                quality["gc"] = (left["gc"] + right["gc"]) / 2

                quality["length"] = [
                    min(left["length"][0], right["length"][0]),
                    max(left["length"][1], right["length"][1])
                ]

            bases_keys = ["mean", "median", "lower", "upper", "10%", "90%"]

            quality["bases"] = [[base[key] for key in bases_keys] for base in left["bases"]]

            if right:
                assert(len(left["bases"]) == len(right["bases"]))

                for i, base in enumerate(quality["bases"]):
                    right_bases = [[base[key] for key in bases_keys] for base in right["bases"]]

                    quality["bases"][i] = average_list(
                        base,
                        right_bases[i]
                    )

            composition_keys = ["g", "a", "t", "c"]

            quality["composition"] = [[base[key] for key in composition_keys] for base in left["composition"]]

            if right:
                assert (len(left["composition"]) == len(right["composition"]))

                for i, base in enumerate(quality["composition"]):
                    right_composition = [[base[key] for key in composition_keys] for base in right["composition"]]

                    quality["composition"][i] = average_list(
                        base,
                        right_composition[i]
                    )

            quality["sequences"] = [0] * 50

            for side in [left, right]:
                if side:
                    for entry in side["sequences"]:
                        quality["sequences"][entry["quality"]] += entry["count"]

            quality_updates.append({
                "_id": document["_id"],
                "quality": quality
            })

        for entry in quality_updates:
            db_sync.samples.update({"_id": entry["_id"]}, {
                "$set": {"quality": entry["quality"]}
            })

        db_sync.samples.update({}, {
            "$unset": {"format": "", "analyses": ""},
            "$inc": {"_version": 1}
        }, multi=True)

    @virtool.gen.coroutine
    def sync_processor(self, documents):
        """
        Redefined from superclass to prevent syncing of documents for which the requesting connection doesn't have read
        rights.

        :param documents: the documents to process
        :type documents: list

        :return: the processed documents
        :rtype: list

        """
        documents = virtool.database.coerce_list(documents)

        to_send = list()

        user = None

        for document in documents:

            send = user is None or (
                document["group"] == "none" or document["all_read"] or user["_id"] == document["username"] or
                document["group"] in user["groups"] or "administrator" in user["groups"]
            )

            if send:
                analysis_count = yield self.dispatcher.collections["analyses"].find({
                    "sample_id": document["_id"]
                }).count()

                if not document["analyzed"] and analysis_count > 0:
                    document["analyzed"] = "ip"
                to_send.append(document)

        return to_send

    @virtool.gen.coroutine
    def dispatch(self, operation, data, collection_name=None, connections=None, sync=False):
        """
        A redefinition of :meth:`.database.Collection.dispatch` that only dispatches sample change messages to
        connections that have permission to read them.

        :param operation: the operation that should be performed by the client on its local representation of the data.
        :type operation: str

        :param data: the data payload associated with the operation
        :type data: dict or list

        :param collection_name: override for :attr:`collection_name`.
        :type collection_name: str

        :param connections: The connections to send the dispatch to. By default, it will be sent to all connections.
        :type connections: list

        :param sync: indicates whether dispatch is part of a sync operation
        :type connections: bool

        """
        if sync:
            assert len(connections) == 1

        connections = connections or self.dispatcher.connections

        data = virtool.database.coerce_list(data)

        if operation == "remove":
            data = [{"_id": item} for item in data]

        send_count = 0

        for connection in connections:
            to_send = list()
            to_remove = list()

            for item in data:
                if operation in ["add", "update"] and can_read(connection.user, item):
                    to_send.append(item)
                else:
                    to_remove.append(item["_id"])

            send_count = len(to_send)

            if send_count > 0:
                yield super().dispatch(
                    operation,
                    to_send,
                    collection_name,
                    [connection],
                    sync
                )

            if len(to_remove) > 0:
                yield super().dispatch(
                    "remove",
                    to_remove,
                    collection_name,
                    [connection],
                    sync
                )

        return send_count

    @virtool.gen.exposed_method(["add_sample"])
    def new(self, transaction):
        """
        Creates a new sample based on the data in ``transaction`` and starts a sample import job.

        Adds the imported files to the :attr:`.excluded_files` list so that they will not be imported again. Ensures
        that a valid subtraction host was the submitted. Configures read and write permissions on the sample document
        and assigns it a creator username based on the connection attached to the transaction.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        """
        data = transaction.data

        # Check if the submitted sample name is unique if unique sample names are being enforced.
        if self.settings.get('sample_unique_names'):
            name_count = yield self.find({"name": data["name"]}).count()

            if name_count > 0:
                return False, dict(message="Sample name already exists.")

        sample_id = yield self.get_new_id()

        # Get a list of the subtraction hosts in MongoDB that are ready for use during analysis.
        available_subtraction_hosts = yield self.dispatcher.collections["hosts"].find().distinct("_id")

        # Make sure a subtraction host was submitted and it exists.
        if not data["subtraction"] or data["subtraction"] not in available_subtraction_hosts:
            return False, dict(message="Could not find subtraction host or none was supplied.")

        # Add the submitted file names for import to the excluded_files list.
        self.excluded_files += data["files"]

        # Construct a new sample entry.
        data.update({
            "_id": sample_id,
            "username": transaction.connection.user["_id"]
        })

        sample_group_setting = self.dispatcher.settings.get("sample_group")

        # Assign the user's primary group as the sample owner group if the ``sample_group`` settings is
        # ``users_primary_group``.
        if sample_group_setting == "users_primary_group":
            data["group"] = yield self.dispatcher.collections["users"].get_field(
                data["username"],
                "primary_group"
            )

        # Make the owner group none if the setting is none.
        if sample_group_setting == "none":
            data["group"] = "none"

        # Add the default sample right fields to the sample document.
        data.update({
            "group_read": self.dispatcher.settings.get("sample_group_read"),
            "group_write": self.dispatcher.settings.get("sample_group_write"),
            "all_read": self.dispatcher.settings.get("sample_all_read"),
            "all_write": self.dispatcher.settings.get("sample_all_write")
        })

        task_args = dict(data)

        data.update({
            "added": virtool.utils.timestamp(),
            "format": "fastq",

            "imported": "ip",
            "quality": None,

            "analyzed": False,

            "hold": True,
            "archived": False
        })

        response = yield self.insert(data)

        # Start the import job
        proc, mem = 2, 6

        self.dispatcher.collections["jobs"].new("import_reads", task_args, proc, mem, data["username"])

        return True, response

    @virtool.gen.exposed_method([])
    def analyze(self, transaction):
        """
        Starts a job to analyze a sample entry. Can take a list of sample ids to analyze and start multiple analysis
        jobs. Creates a new analysis document in the analyses collection.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        """
        data = transaction.data
        username = transaction.connection.user["_id"]

        # Get list of samples from task_args and start a job for each one
        samples = data.pop("samples")

        analysis_ids = list()

        # Add an analysis entry and reference and start an analysis job for each sample in samples.
        for sample_id in samples:
            # Generate a unique _id for the analysis entry
            analysis_id = yield self.dispatcher.collections["analyses"].new(
                sample_id,
                data["name"],
                username,
                data["algorithm"]
            )

            analysis_ids.append(analysis_id)

        return True, dict(analysis_ids=analysis_ids)

    @virtool.gen.exposed_method([])
    def quality_pdf(self, transaction):
        detail = yield self._detail(transaction.data["_id"])
        pdf = yield virtool.plots.quality_report(detail["quality"])

        file_id = yield self.dispatcher.file_manager.register("quality.pdf", pdf, content_type="pdf", download=True)

        return True, {"file_id": file_id}

    @virtool.gen.coroutine
    def _detail(self, sample_id):
        """
        View the complete details for and sample record including FASTQC and analysis data.

        """
        # Get the entire entry for the virus.
        detail = yield self.find_one({"_id": sample_id})
        return detail

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        detail = yield self._detail(transaction.data["_id"])
        return True, detail

    @virtool.gen.coroutine
    def set_stats(self, data):
        """
        Populates the ``quality`` field of the document with data generated by FastQC. Data includes GC content, read
        length ranges, and detailed quality data. Also sets the ``imported`` field to ``True``.

        Called from an :class:`.ImportReads` job.

        :param data: the data to be added to the sample document
        :type data: dict

        """
        yield self.update(data["_id"], {
            "$set": {
                "quality": data["fastqc"],
                "imported": True
            }
        })

        files = yield self.get_field(data["_id"], "files")

        for filename in files:
            self.excluded_files.remove(filename)

    @virtool.gen.exposed_method([])
    def set_field(self, transaction):
        """
        Set the value of a specific field. Field must be one of ``name``, ``host``, ``isolate``.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating the success of the operation and the response from the Mongo update operation
        :rtype: tuple

        """
        if transaction.data["field"] in ["name", "host", "isolate"]:
            response = yield self.update(transaction.data["_id"], {
                "$set": {
                    transaction.data["field"]: transaction.data["value"]
                }
            })

            return True, response

        return False, dict(message="Attempted to change unknown or illegal field: " + transaction.data["field"])

    @virtool.gen.exposed_method([])
    def set_group(self, transaction):
        """
        Set the owner group for the sample. Fails if the passed group id does not exist.

        .. note::

            Only administrators or the owner of the sample can call this method on it.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating the success of the operation and the response from the Mongo update operation
        :rtype: tuple

        """
        data = transaction.data
        user = transaction.connection.user

        sample_owner = yield self.get_field(data["_id"], "username")

        if "administrator" not in user["groups"] and user["_id"] != sample_owner:
            return False, dict(message="Must be administrator or sample owner.")

        existing_group_ids = yield self.dispatcher.collections["groups"].find({}, {"_id": True}).distinct("_id")

        if data["group_id"] not in existing_group_ids:
            return False, dict(message="Passed group id does not exist.")

        response = yield self.update(data["_id"], {
            "$set": {
                "group": data["group_id"]
            }
        })

        return True, response

    @virtool.gen.exposed_method([])
    def set_rights(self, transaction):
        """
        Changes rights setting for the specified sample document. The only acceptable rights keys are ``all_read``,
        ``all_write``, ``group_read``, ``group_write``.

        .. note::

            Only administrators or the owner of the sample can call this method on it.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating the success of the operation and the response from the Mongo update operation
        :rtype: tuple

        """
        data = transaction.data
        user = transaction.connection.user

        # Get the username of the owner of the sample document.
        sample_owner = yield self.get_field(data["_id"], "username")

        # Only update the document if the connected user owns the samples or is an administrator.
        if "administrator" in user["groups"] or user["_id"] == sample_owner:

            # Make a dict for updating the rights fields. Fail the transaction if there is an unknown right key.
            for key in data["changes"]:
                if key not in ["all_read", "all_write", "group_read", "group_write"]:
                    return False, dict(message="Found unknown right name " + key)

            # Update the sample document with the new rights.
            response = yield self.update(data["_id"], {
                "$set": data["changes"]
            })

            return True, response

        return False, dict(message="Must be administrator or sample owner.")

    @virtool.gen.exposed_method([])
    def archive(self, transaction):
        """
        Archives the sample identified by the passed sample id. Sets the ``archived`` field in the sample document to
        ``True``.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating the success of the call and the response from the Mongo update operation
        :rtype: tuple

        """
        id_list = virtool.database.coerce_list(transaction.data["_id"])

        response = yield self.update({"_id": {"$in": id_list}}, {
            "$set": {
                "archived": True
            }
        })

        return True, response

    @virtool.gen.coroutine
    def _remove_samples(self, id_list):
        """
        Complete removes the samples identified by the document ids in ``id_list``. In order, it:

        - removes all analyses associated with the sample from the analyses collection
        - removes the sample from the samples collection
        - removes the sample directory from the file system
        - removes files associated with the sample from :attr:`.excluded_files`.

        :param id_list: a list sample ids to remove
        :type id_list: list

        :return: the response from the samples collection remove operation
        :rtype: dict

        """
        # Remove all analysis documents associated with the sample.
        yield self.dispatcher.collections["analyses"].remove_by_sample_id(id_list)

        # Make a list of read files that will no longer be hidden in the watch directory.
        files_to_reinclude = list()

        samples_cursor = self.find({"_id": {"$in": id_list}}, {"files": True})

        while (yield samples_cursor.fetch_next):
            files_to_reinclude += samples_cursor.next_object()["files"]

        # Remove the samples described by id_list from the database.
        response = yield super().remove(id_list)

        samples_path = os.path.join(self.settings.get("data_path"), "samples")

        for sample_id in id_list:
            shutil.rmtree(os.path.join(samples_path, "sample_" + sample_id))

        # Only make previously excluded read files available the sample(s) were removed successfully. Make them
        # available by removing them from self.excluded_files.
        if response:
            self.excluded_files = list(filter(lambda filename: filename not in files_to_reinclude, self.excluded_files))

        return response

    @virtool.gen.exposed_method([])
    def remove_sample(self, transaction):
        """
        Remove the sample identified by the passed document id. Serves as an exposed proxy for calling
        :meth:`._remove_samples`.

        :param transaction: the transaction associated with the request.
        :type transaction: :class:`.Transaction`

        :return: a boolean indicating if the call was successful and the remove response from MongoDB
        :rtype: tuple

        """
        id_list = virtool.database.coerce_list(transaction.data["_id"])

        response = yield self._remove_samples(id_list)

        return True, response

    @virtool.gen.coroutine
    def watch(self):
        """
        Called as a :ref:`periodic callback <periodic-callbacks>` to check if the contents of the watch path has have
        changes. Any changes are dispatched to all listening clients. The callback is not executed if there are no
        listeners.

        File names in :attr:`.excluded_files` are excluded from the check.

        """
        files = yield virtool.utils.list_files(self.settings.get("watch_path"), self.excluded_files)

        return files


class ImportReads(virtool.job.Job):

    """
    A subclass of :class:`~.job.Job` that creates a new sample by importing reads from the watch directory. Has the
    stages:

    1. mk_sample_dir
    2. import_files
    3. trim_reads
    4. save_trimmed
    5. fastqc
    6. parse_fastqc
    7. clean_watch

    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        #: The id assigned to the new sample.
        self.sample_id = self.task_args["_id"]

        #: The path where the files for this sample are stored.
        self.sample_path = self.settings["data_path"] + "/samples/sample_" + str(self.sample_id)

        #: The names of the reads files in the watch path used to create the sample.
        self.files = self.task_args["files"]

        #: Is the sample library paired or not.
        self.paired = self.task_args["paired"]

        #: The ordered list of :ref:`stage methods <stage-methods>` that are called by the job.
        self.stage_list = [
            self.mk_sample_dir,
            self.trim_reads,
            self.save_trimmed,
            self.fastqc,
            self.parse_fastqc,
            self.clean_watch
        ]

    @virtool.job.stage_method
    def mk_sample_dir(self):
        """
        Make a data directory for the sample. Read files, quality data from FastQC, and analysis data will be stored
        here.

        """
        try:
            os.makedirs(os.path.join(self.sample_path, "analysis"))
        except OSError:
            shutil.rmtree(self.sample_path)
            os.makedirs(os.path.join(self.sample_path, "analysis"))

    def trim_reads(self):
        input_paths = [os.path.join(self.settings["watch_path"], filename) for filename in self.files]

        command = [
            "skewer",
            "-m", "pe" if self.paired else "head",
            "-l", "50",
            "-q", "20",
            "-Q", "25",
            "-t", str(self.settings.get("import_reads_proc")),
            "-o", os.path.join(self.sample_path, "reads"),
        ] + input_paths

        # Prevents an error from skewer when calls inside a subprocess.
        env = dict(os.environ)
        env["LD_LIBRARY_PATH"] = "/usr/lib/x86_64-linux-gnu"

        self.run_process(command, dont_read_stdout=True, env=env)

    def save_trimmed(self):
        """
        Give the trimmed FASTQ and log files generated by skewer more readable names.

        """
        if self.paired:
            shutil.move(
                os.path.join(self.sample_path, "reads-trimmed-pair1.fastq"),
                os.path.join(self.sample_path, "reads_1.fastq")
            )

            shutil.move(
                os.path.join(self.sample_path, "reads-trimmed-pair2.fastq"),
                os.path.join(self.sample_path, "reads_2.fastq")
            )

        else:
            shutil.move(
                os.path.join(self.sample_path, "reads-trimmed.fastq"),
                os.path.join(self.sample_path, "reads_1.fastq")
            )

        shutil.move(
            os.path.join(self.sample_path, "reads-trimmed.log"),
            os.path.join(self.sample_path, "trim.log")
        )

    def fastqc(self):
        """
        Runs FastQC on the renamed, trimmed read files.

        """
        os.mkdir(self.sample_path + "/fastqc")

        command = [
            "fastqc",
            "-f", "fastq",
            "-o", os.path.join(self.sample_path, "fastqc"),
            "-t", "2",
            "--extract",
            self.sample_path + "/reads_1.fastq"
        ]

        if self.paired:
            command.append(os.path.join(self.sample_path, "reads_2.fastq"))

        self.run_process(command)

    def parse_fastqc(self):
        """
        Capture the desired data from the FastQC output. The data is added to the samples database
        in the main run() method

        """
        # Get the text data files from the FastQC output
        for name in os.listdir(self.sample_path + "/fastqc"):
            if "reads" in name and "." not in name:
                suffix = name.split("_")[1]
                folder = self.sample_path + "/fastqc/" + name
                shutil.move(folder + "/fastqc_data.txt", self.sample_path + "/fastqc_" + suffix + ".txt")

        # Dispose of the rest of the data files.
        shutil.rmtree(self.sample_path + "/fastqc")

        fastqc = {
            "count": 0
        }

        # Parse data file(s)
        for suffix in [1, 2]:
            try:
                # Open a FastQC data file and begin parsing it
                with open(self.sample_path + "/fastqc_" + str(suffix) + ".txt") as data:
                    # This is flag is set when a multi-line FastQC section is found. It is set to None when the section
                    # ends and is the default value when the parsing loop beings
                    flag = None

                    for line in data:
                        # Turn off flag if the end of a module is encountered
                        if flag is not None and "END_MODULE" in line:
                            flag = None

                        # Total sequences
                        elif "Total Sequences" in line:
                            fastqc["count"] += int(line.split("\t")[1])

                        # Read encoding (eg. Illumina 1.9)
                        elif "encoding" not in fastqc and "Encoding" in line:
                            fastqc["encoding"] = line.split("\t")[1]

                        # Length
                        elif "Sequence length" in line:
                            length = [int(s) for s in line.split("\t")[1].split('-')]

                            if suffix == 1:
                                fastqc["length"] = length
                            else:
                                fastqc["length"] = [
                                    min([fastqc["length"][0], length[0]]),
                                    max([fastqc["length"][1], length[1]])
                                ]

                        # GC-content
                        elif "%GC" in line and "#" not in line:
                            gc = float(line.split("\t")[1])

                            if suffix == 1:
                                fastqc["gc"] = gc
                            else:
                                fastqc["gc"] = (fastqc["gc"] + gc) / 2

                        # The statements below handle the beginning of multi-line FastQC sections. They set the flag
                        # value to the found section and allow it to be further parsed.
                        elif "Per base sequence quality" in line:
                            flag = "bases"
                            if suffix == 1:
                                fastqc[flag] = [None] * fastqc["length"][1]

                        elif "Per sequence quality scores" in line:
                            flag = "sequences"
                            if suffix == 1:
                                fastqc[flag] = [0] * 50

                        elif "Per base sequence content" in line:
                            flag = "composition"
                            if suffix == 1:
                                fastqc[flag] = [None] * fastqc["length"][1]

                        # The statements below handle the parsing of lines when the flag has been set for a multi-line
                        # section. This ends when the 'END_MODULE' line is encountered and the flag is reset to none
                        elif flag in ["composition", "bases"] and "#" not in line:
                            # Split line around whitespace.
                            split = line.rstrip().split()

                            # Convert all fields except first to 2-decimal floats.
                            values = [round(int(value.split(".")[0]), 1) for value in split[1:]]

                            # Convert to position field to a one- or two-member tuple.
                            pos = [int(x) for x in split[0].split('-')]

                            if len(pos) > 1:
                                pos = range(pos[0], pos[1] + 1)
                            else:
                                pos = [pos[0]]

                            if suffix == 1:
                                for i in pos:
                                    fastqc[flag][i - 1] = values
                            else:
                                for i in pos:
                                    fastqc[flag][i - 1] = average_list(fastqc[flag][i - 1], values)

                        elif flag == "sequences" and "#" not in line:
                            line = line.rstrip().split()

                            quality = int(line[0])

                            fastqc["sequences"][quality] += int(line[1].split(".")[0])

            # No suffix of 2 will be present for single-end samples
            except IOError:
                pass

        self.collection_operation("samples", "set_stats", {
            "_id": self.sample_id,
            "fastqc": fastqc
        })

    def clean_watch(self):
        """ Try to remove the original read files from the watch directory """
        for read_file in self.files:
            os.remove(os.path.join(self.settings["watch_path"], read_file))

    def cleanup(self):
        """
        This method is run in the event of an error or cancellation signal. It deletes the sample directory
        and wipes the sample information from the samples_db collection. Watch files are not deleted.

        """
        # Delete database entry
        self.collection_operation("samples", "_remove_samples", [self.sample_id])


def check_collection(db_name, data_path, address="localhost", port=27017):
    db = pymongo.MongoClient(address, port)[db_name]

    response = {
        "orphaned_analyses": list(),
        "missing_analyses": list(),
        "orphaned_samples": list(),
        "mismatched_samples": list(),
    }

    existing_analyses = [entry["_id"] for entry in db.analyses.find({}, {"_id": True})]

    aggregated = db.samples.aggregate([
        {"$project": {"analyses": True}},
        {"$unwind": {"path": "$analyses"}}
    ])["result"]

    linked_analyses = [result["analyses"] for result in aggregated]

    response["orphaned_analyses"] = list(filter(lambda x: x not in linked_analyses, existing_analyses))
    response["missing_analyses"] = list(filter(lambda x: x not in existing_analyses, linked_analyses))

    db_samples = {entry["_id"]: len(entry["files"]) for entry in db.samples.find({}, {"files": True})}

    fs_samples = dict()

    samples_path = os.path.join(data_path, "samples/")

    for dirname in os.listdir(samples_path):
        sample_files = os.listdir(os.path.join(samples_path, dirname))
        fastq = filter(lambda x: x.endswith("fastq") or x.endswith("fq"), sample_files)
        fs_samples[dirname.replace("sample_", "")] = len(list(fastq))

    response["defiled_samples"] = list(filter(lambda x: x not in fs_samples, db_samples.keys()))

    for sample_id, file_count in fs_samples.items():
        if sample_id not in db_samples:
            response["orphaned_samples"].append(sample_id)
        elif file_count != db_samples[sample_id]:
            response["mismatched_samples"].append(sample_id)

    response["failed"] = len(response["missing_analyses"]) > 0 or len(response["mismatched_samples"]) > 0

    return response


def reduce_library_size(input_path, output_path):
    line_count = subprocess.check_output(["wc", "-l", input_path])
    decoded = line_count.decode("utf-8")

    seq_count = int(int(decoded.split(" ")[0]) / 4)

    if seq_count > 17000000:
        randomized_indexes = random.sample(range(0, seq_count), 17000000)

        randomized_indexes.sort()

        next_read_index = randomized_indexes[0] * 4
        next_index = 1
        line_count = 0
        writing = False

        with open(input_path, "r") as input_file:
            with open(output_path, "w") as output_file:

                for index, line in enumerate(input_file):
                    if index == next_read_index:
                        try:
                            next_read_index = randomized_indexes[next_index] * 4
                            next_index += 1
                            writing = True
                        except IndexError:
                            break

                    if writing:
                        if line_count == 0:
                            assert line.startswith("@")

                        output_file.write(line)
                        line_count += 1

                        if line_count == 4:
                            writing = False
                            line_count = 0

        os.remove(input_path)

    else:
        os.rename(input_path, output_path)


def can_read(user, document):
    return document["all_read"] or (document["group_read"] and document["group"] in user["groups"])


def average_list(list1, list2):
    try:
        assert len(list1) == len(list2)
    except AssertionError:
        raise

    return [(value + list2[i]) / 2 for i, value in enumerate(list1)]
