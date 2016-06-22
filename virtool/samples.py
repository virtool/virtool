import os
import re
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


class Collection(virtool.database.Collection):
    """
    A connection to the pymongo samples collection. Provides methods for viewing and modifying the
    collection.

    """
    def __init__(self, dispatcher):
        super(Collection, self).__init__("samples", dispatcher)

        dispatcher.watcher.register("reads", self.watch)

        # Extend sync_projector. These fields will be passed to the client to populate sample tables.
        self.sync_projector.update({field: True for field in [
            "name",
            "added",
            "username",
            "analyses",
            "imported",
            "archived",
            "analyzed",
            "group",
            "group_read",
            "group_write",
            "all_read",
            "all_write"
        ]})

        db_sync = virtool.utils.get_db_client(self.settings, sync=True)

        db_sync.analyses.update({"algorithm": {"$exists": False}}, {
            "$set": {
                "algorithm": "pathoscope"
            }
        }, multi=True)

        unready_analyses = [analysis["_id"] for analysis in db_sync.analyses.find({"ready": False}, {"_id": True})]

        db_sync.samples.update({}, {
            "$pull": {"analyses": {"$in": unready_analyses}},
            "$inc": {"_version": 1}
        }, multi=True)

        db_sync.analyses.remove({"_id": {"$in": unready_analyses}})

        self.excluded_files = list()

        self.analyses_collection = virtool.utils.get_db_client(self.settings, sync=False)["analyses"]

    @virtool.gen.coroutine
    def sync_processor(self, documents):
        documents = virtool.database.coerce_list(documents)

        to_send = list()

        user = None

        for document in documents:

            send = user is None or (
                document["group"] == "none" or document["all_read"] or user["_id"] == document["username"] or
                document["group"] in user["groups"] or "administrator" in user["groups"]
            )

            if send:
                analyses = document.pop("analyses")
                if not document["analyzed"] and len(analyses) > 0:
                    document["analyzed"] = "ip"
                to_send.append(document)

        return to_send

    @virtool.gen.coroutine
    def dispatch(self, operation, data, collection_name=None, connections=None, sync=False):
        """
        A redefinition of :meth:`.database.Collection.dispatcher` that only dispatches messages about samples to
        connections that are allowed to read them.

        :param operation: the operation that should be performed by the client on its local representation of the data.
        :type operation: str

        :param data: the data payload associated with the operation
        :type data: dict or list

        :param collection_name: override for :attr:`collection_name`.
        :type collection_name: str

        :param connections: The connections to send the dispatch to. By default, it will be sent to all connections.
        :type connections: list

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
                yield super(Collection, self).dispatch(
                    operation,
                    to_send,
                    collection_name,
                    [connection],
                    sync
                )

            if len(to_remove) > 0:
                yield super(Collection, self).dispatch(
                    "remove",
                    to_remove,
                    collection_name,
                    [connection],
                    sync
                )

        return send_count

    @virtool.gen.exposed_method(["add_sample"])
    def new(self, transaction):
        data = transaction.data

        if self.settings.get('sample_unique_names'):
            name_count = yield self.find({"name": data["name"]}).count()

            if name_count > 0:
                return False, dict(message="Sample name already exists.")

        sample_id = yield self.get_new_id()

        self.excluded_files += data["files"]

        # Construct a new sample entry
        data.update({
            "_id": sample_id,
            "username": transaction.connection.user["_id"]
        })

        sample_group_setting = self.dispatcher.settings.get("sample_group")

        if sample_group_setting == "users_primary_group":
            data["group"] = yield self.dispatcher.collections["users"].get_field(
                data["username"],
                "primary_group"
            )

        if sample_group_setting == "none":
            data["group"] = "none"

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
            "analyses": [],

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
        Start a job to analyze a sample entry. The task arguments are parsed from the form data sent by
        the client.

        """
        data = transaction.data

        username = transaction.connection.user["_id"]

        # Get list of samples from task_args and start a job for each one
        samples = data.pop("samples")

        algorithm = data.pop("algorithm")

        # Update the data dictionary with the username of the job submitter.
        data["username"] = username

        # A list of _ids that are reserved during the running of this method.
        used_ids = list()

        index_id, index_version = yield self.dispatcher.collections["indexes"].get_current_index()

        # Add an analysis entry and reference and start an analysis job for each sample in samples.
        for sample_id in samples:
            # Generate a unique _id for the analysis entry
            analysis_id = yield virtool.utils.get_new_document_id(self.analyses_collection, excluded=used_ids)
            used_ids.append(analysis_id)

            # Insert the new analysis entry in the analysis database collection.
            analysis_document = dict(data)

            job_id = yield self.dispatcher.collections["jobs"].get_new_id()

            analysis_document.update({
                "_id": analysis_id,
                "ready": False,
                "job": job_id,
                "index_id": index_id,
                "index_version": index_version,
                "sample": sample_id,
                "algorithm": algorithm,
                "timestamp": virtool.utils.timestamp()
            })

            yield self.analyses_collection.insert(analysis_document)

            # Add a reference to the analysis _id in the sample collection
            yield self.update(sample_id, {
                "$push": {"analyses": analysis_id}
            })

            # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
            # _id. This dictionary will be passed the the new analysis job.
            task_args = dict(data)

            task_args.update({
                "index_id": index_id,
                "analysis_id": analysis_id,
                "sample_id": sample_id
            })

            yield self.dispatcher.collections["jobs"].new(
                algorithm,
                task_args,
                self.settings.get(algorithm + "_proc"),
                self.settings.get(algorithm + "_mem"),
                username,
                job_id=job_id
            )

        return True, None

    @virtool.gen.coroutine
    def set_analysis(self, data):
        # Get the analysis in question and update it with the new data.
        analysis = yield self.analyses_collection.find_one({"_id": data["analysis_id"]})
        analysis.update(data["analysis"])
        analysis["ready"] = True

        yield self.analyses_collection.update({"_id": data["analysis_id"]}, {"$set": analysis})

        yield self.update(data["_id"], {
            "$inc": {"_version": 1},
            "$set": {"analyzed": True}
        })

    @virtool.gen.exposed_method([])
    def remove_analysis(self, transaction):
        """
        Set the 'fastqc' or 'analysis' to False, clearing it. Scope select which to field to clear. Both are cleared if
        it is passed as None.

        """
        data = transaction.data

        yield self._remove_analysis(data)

        return True, None

    @virtool.gen.coroutine
    def _remove_analysis(self, data):
        # Get the sample document to check which analysis_ids are tied to the sample.
        sample_analyses = yield self.get_field(data["_id"], "analyses")

        sample_analyses.remove(data["analysis_id"])

        minimal_analyses = yield self.analyses_collection.find(
            {"_id": {"$in": sample_analyses}},
            {"ready": True}
        ).to_list(length=500)

        analyzed = True in [document["ready"] for document in minimal_analyses]

        # Remove analysis entry from database
        yield self.analyses_collection.remove({"_id": data["analysis_id"]})

        yield self.update(data["_id"], {
            "$pull": {"analyses": data["analysis_id"]},
            "$set": {"analyzed": analyzed}
        })

        # Remove the analysis directory
        path = self.settings.get("data_path") + "/samples/sample_" + data["_id"] + "/analysis/" + data["analysis_id"]

        try:
            yield virtool.utils.rm(path, recursive=True)
        except FileNotFoundError:
            pass

    @virtool.gen.exposed_method([])
    def quality_pdf(self, transaction):
        detail = yield self._detail(transaction.data["_id"])
        pdf = yield virtool.plots.quality_report(detail["quality"])

        file_id = yield self.dispatcher.file_manager.register("quality.pdf", pdf, content_type="pdf", download=True)

        return True, {"file_id": file_id}

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        detail = yield self._detail(transaction.data["_id"])
        return True, detail

    @virtool.gen.coroutine
    def _detail(self, sample_id):
        """
        View the complete details for and sample record including FASTQC and RSEM data.

        """
        # Get the entire entry for the virus.
        sample_document = yield self.find_one({"_id": sample_id})

        detail = yield self.parse_detail(sample_document)

        analyses = yield self.analyses_collection.find({"_id": {"$in": detail["analyses"]}}).to_list(None)

        isolate_fields = ["isolate_id", "default", "source_name", "source_type"]
        sequence_fields = ["host", "definition"]

        for analysis in analyses:
            # Only included 'ready' analyses in the detail payload.
            if analysis["ready"] is True:
                if analysis["algorithm"] == "pathoscope":
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
                            _, virus_document, _ = yield self.dispatcher.collections["history"].get_versioned_document(
                                virus_id,
                                virus_version + 1
                            )

                            fetched_viruses[virus_id] = virus_document

                            annotated[virus_id] = {
                                "_id": virus_id,
                                "name": virus_document["name"],
                                "abbreviation": virus_document["abbreviation"],
                                "isolates": dict()
                            }

                        virus_document = fetched_viruses[virus_id]

                        for isolate in virus_document["isolates"]:
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

                    analysis["diagnosis"] = [annotated[virus_id] for virus_id in annotated]

        detail["analyses"] = analyses

        return detail

    @virtool.gen.synchronous
    def parse_pathoscope(self, analysis):
        pass

    @virtool.gen.synchronous
    def parse_nuvs(self, analysis):
        pass

    @virtool.gen.synchronous
    def parse_detail(self, detail):
        is_paired = detail["paired"]

        if detail["quality"] and not detail["imported"] == "ip":
            fastqc = detail["quality"]
            new = dict()

            # Get encoding assuming encoding is same for left and right
            new["encoding"] = fastqc["left"]["encoding"]

            # Get count by summing count for each side
            new["count"] = fastqc["left"]["count"]
            if is_paired:
                new["count"] += fastqc["right"]["count"]

            # Get average GC from the two sides
            if is_paired:
                new["gc"] = (fastqc["left"]["gc"] + fastqc["right"]["gc"]) / 200
            else:
                new["gc"] = fastqc["left"]["gc"] / 100

            # Get L-R combined length range
            if is_paired:
                length_r = fastqc["right"]["length"]
                length_l = fastqc["left"]["length"]
                new["length"] = [max(length_r[i], length_l[i]) for i in [0, 1]]
            else:
                new["length"] = fastqc["left"]["length"]

            # Average base contents
            new["composition"] = fastqc["left"]["composition"]

            if is_paired:
                for i, entry in enumerate(fastqc["right"]["composition"]):
                    for base in ["a", "t", "g", "c"]:
                        new["composition"][i][base] += entry[base]
                        new["composition"][i][base] /= 2

            # Sequence quality
            sequences = dict()

            sides = ["left"]

            if is_paired:
                sides.append("right")

            for side in sides:
                sequences[side] = {i["quality"]: i["count"] for i in fastqc[side]["sequences"]}

            if is_paired:
                for q in sequences["right"]:
                    try:
                        sequences["left"][q] += sequences["right"][q]
                    except KeyError:
                        sequences["left"][q] = sequences["right"][q]

            sequences["left"] = {i["quality"]: i["count"] for i in fastqc["left"]["sequences"]}
            new["sequences"] = [{"quality": q, "count": sequences["left"][q]} for q in sequences["left"]]

            # Base-wise quality
            new["bases"] = fastqc["left"]["bases"]

            if is_paired:
                for i, entry in enumerate(fastqc["right"]["bases"]):
                    for key in entry.keys():
                        new["bases"][i][key] += entry[key]
                        new["bases"][i][key] /= 2

            detail["quality"] = new

        return detail

    @virtool.gen.coroutine
    def complete(self, _id):
        """
        Called when the import process is finished/terminated for this sample.The hold property is set to 'false' so
        that the filename is no longer held and will reappear in the sample import list if the file still exists.

        """
        yield self.update(_id, {"$set": {"hold": False}})

    @virtool.gen.coroutine
    def set_stats(self, data):
        yield self.update(data["_id"], {"$set": {"quality": data["fastqc"], "imported": True}})

        files = yield self.get_field(data["_id"], "files")

        for filename in files:
            self.excluded_files.remove(filename)

    @virtool.gen.exposed_method([])
    def set_field(self, transaction):
        fields = [
            "name",
            "host",
            "isolate",
            ""
        ]

        if transaction.data["field"] in fields:
            response = yield self.update(transaction.data["_id"], {
                "$set": {
                    transaction.data["field"]: transaction.data["value"]
                }
            })

            return True, response

        return False, dict(message="Attempted to change unknown or illegal field: " + transaction.data["field"])

    @virtool.gen.exposed_method([])
    def set_group(self, transaction):
        data = transaction.data
        user = transaction.connection.user

        sample_owner = yield self.get_field(data["_id"], "username")

        if "administrator" in user["groups"] or user["_id"] == sample_owner:
            response = yield self.update(data["_id"], {
                "$set": {
                    "group": data["group_id"]
                }
            })

            return True, response

        return False, dict(message="Must be administrator or sample owner.")

    @virtool.gen.exposed_method([])
    def set_rights(self, transaction):
        data = transaction.data
        user = transaction.connection.user

        sample_owner = yield self.get_field(data["_id"], "username")

        if "administrator" in user["groups"] or user["_id"] == sample_owner:
            new_rights = dict()

            for key, value in data["changes"].items():
                if key in ["all_read", "all_write", "group_read", "group_write"]:
                    new_rights[key] = value

            response = yield self.update(data["_id"], {
                "$set": new_rights
            })

            return True, response

        return False, dict(message="Must be administrator or sample owner.")

    @virtool.gen.exposed_method([])
    def archive(self, transaction):
        """
        Remove a sample from the database by sample_id

        """
        id_list = virtool.database.coerce_list(transaction.data["_id"])

        response = yield self.update({"_id": {"$in": id_list}}, {
            "$set": {
                "archived": True
            }
        })

        return True, response

    @virtool.gen.exposed_method([])
    def remove_sample(self, transaction):
        """
        Remove one or more samples from the database given a data dict containing an id or list of ids keyed by '_id'.

        :param transaction: the transaction generated by the request.
        :return: the response from the Mongo remove operation.

        """
        response = yield self._remove_sample(transaction.data["_id"])

        return True, response

    @virtool.gen.coroutine
    def _remove_sample(self, id_list):
        id_list = virtool.database.coerce_list(id_list)

        # Remove all analysis documents associated with the sample.
        yield self.analyses_collection.remove({"sample": {"$in": id_list}})

        # Make a list of read files that will no longer be hidden in the watch directory.
        files_to_reinclude = list()

        samples_cursor = self.find({"_id": {"$in": id_list}}, {"files": True})

        while (yield samples_cursor.fetch_next):
            files_to_reinclude += samples_cursor.next_object()["files"]

        # Remove the samples described by id_list from the database.
        response = yield super(Collection, self).remove(id_list)

        # Only make previously excluded read files available the sample(s) were removed successfully. Make them
        # available by removing them from self.excluded_files.
        if response:
            self.excluded_files = list(filter(lambda filename: filename not in files_to_reinclude, self.excluded_files))

        return response

    @virtool.gen.coroutine
    def watch(self):
        """
        A perpetually running coroutine that dispatches to listening connections any changes to files in the watch path.
        The patch is checked every 500 ms and self.excluded_files list will be excluded from check and dispatched list.

        """
        files = yield virtool.utils.list_files(self.settings.get("watch_path"), self.excluded_files)
        return files


class ImportReads(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Get file list
        self.files = self.task_args["files"]
        self.sample_id = self.task_args["_id"]
        self.paired = self.task_args["paired"]

        # This is the sample root directory
        self.sample_path = self.settings["data_path"] + "/samples/sample_" + str(self.sample_id)

        self.stage_list = [
            self.mk_sample_dir,
            self.import_files,
            self.trim_reads,
            self.save_trimmed,
            self.fastqc,
            self.parse_fastqc,
            self.clean_watch
        ]

        self.progress_re = re.compile(r"([0-9]*)\.")

    def mk_sample_dir(self):
        try:
            os.mkdir(self.sample_path)
            os.mkdir(self.sample_path + "/analysis")
        except OSError:
            shutil.rmtree(self.sample_path)
            os.mkdir(self.sample_path)

    def import_files(self):

        destination_path = os.path.join(self.sample_path, "reads.fastq")

        source_paths = [os.path.join(self.settings["watch_path"], filename) for filename in self.files]

        index = 0

        with open(destination_path, "w") as destination:
            for source_path in source_paths:
                with open(source_path, "r") as source:
                    plus = False

                    for line in source:
                        if line[0] == "@" and not plus:
                            line = "@READ" + str(index) + "\n"
                            index += 1

                        plus = line[0] == "+"

                        destination.write(line)

    def trim_reads(self):

        input_path = os.path.join(self.sample_path, "reads.fastq")

        command = [
            "skewer",
            "-l", "36",
            "-t", str(self.settings.get("import_reads_proc")),
            "-o", os.path.join(self.sample_path, "reads"),
            input_path
        ]

        self.run_process(command)

    def save_trimmed(self):
        trimmed_file_path = os.path.join(self.sample_path, "reads-trimmed.fastq")
        keep_path = os.path.join(self.sample_path, "reads_1.fastq")

        reduce_library_size(trimmed_file_path, keep_path)

    def fastqc(self):

        os.mkdir(self.sample_path + "/fastqc")

        command = [
            "fastqc",
            "-f", "fastq",
            "-o", os.path.join(self.sample_path, "fastqc"),
            "-t", "2",
            "--extract",
            self.sample_path + "/reads_1.fastq"
        ]

        self.run_process(command)

    def parse_fastqc(self):
        """
        Capture the desired data from the FastQC output. The data is added to the samples database
        in the main run() method

        """
        fastqc = {}

        # Get the text data files from the FastQC output
        for name in os.listdir(self.sample_path + "/fastqc"):
            if "reads" in name and "." not in name:
                suffix = name.split("_")[1]
                folder = self.sample_path + "/fastqc/" + name
                shutil.move(folder + "/fastqc_data.txt", self.sample_path + "/fastqc_" + suffix + ".txt")

        # Dispose of the rest
        shutil.rmtree(self.sample_path + "/fastqc")

        fields = {
            "bases": {
                0: "base",
                1: "mean",
                2: "median",
                3: "lower",
                4: "upper",
                5: "10%",
                6: "90%"
            },

            "composition": {
                0: "base",
                1: "g",
                2: "a",
                3: "t",
                4: "c"
            }
        }

        # Parse data file(s)
        for suffix in [1, 2]:
            try:
                # This list will store all of the desired data from the FastQC output
                values = dict()

                # Open a FastQC data file and begin parsing it
                with open(self.sample_path + "/fastqc_" + str(suffix) + ".txt") as data:
                    # This is flag is set when a multi-line FastQC section is found. It is set to None when the section
                    # ends and is the default value when the parsing loop beings
                    flag = None

                    for line in data:
                        # Turn off flag if the end of a module is encountered
                        if flag is not None and "END_MODULE" in line:
                            flag = None

                        # Total sequencest
                        elif "Total Sequences" in line:
                            values["count"] = int(line.split("\t")[1])

                        # Read encoding (eg. Illumina 1.9)
                        elif "Encoding" in line:
                            values["encoding"] = line.split("\t")[1]

                        # Length
                        elif "Sequence length" in line:
                            values["length"] = [int(s) for s in line.split("\t")[1].split('-')]

                        # GC-content
                        elif "%GC" in line and "#" not in line:
                            values["gc"] = float(line.split("\t")[1])

                        # The statements below handle the beginning of multi-line FastQC sections. They set the flag
                        # value to the found section and allow it to be further parsed.
                        elif "Per base sequence quality" in line:
                            flag = "bases"
                            values[flag] = [None] * values["length"][1]

                        elif "Per sequence quality scores" in line:
                            flag = "sequences"
                            values[flag] = list()

                        elif "Per base sequence content" in line:
                            flag = "composition"
                            values[flag] = [None] * values["length"][1]

                        # The statements below handle the parsing of lines when the flag has been set for a multi-line
                        # section. This ends when the 'END_MODULE' line is encountered and the flag is reset to none
                        elif flag == "composition" and "#" not in line:
                            # Prepare line for parsing
                            line = line.rstrip().split()
                            entry = dict()
                            pos = None

                            for index in fields[flag]:
                                field = fields[flag][index]

                                if index > 0:
                                    entry[field] = float(line[index])
                                else:
                                    pos = line[index].split('-')
                                    if len(pos) > 1:
                                        pos = list(range(int(pos[0]), int(pos[1]) + 1))
                                    else:
                                        pos = [int(pos[0])]

                            for i in list(pos):
                                values["composition"][i - 1] = entry

                        elif flag == "sequences" and "#" not in line:
                            line = line.rstrip().split()
                            values[flag].append({
                                "quality": int(line[0]),
                                "count": int(float(line[1]))
                            })

                        elif flag == "bases" and "#" not in line:
                            # Prepare line for parsing
                            line = line.rstrip().split()
                            entry = dict()

                            # Translate line positions to field labels and store as JSON
                            for index in fields[flag]:
                                field = fields[flag][index]
                                if index > 0:
                                    entry[field] = float(line[index])
                                else:
                                    pos = line[index].split('-')
                                    if len(pos) > 1:
                                        pos = list(range(int(pos[0]), int(pos[1]) + 1))
                                    else:
                                        pos = [int(pos[0])]

                                    for i in pos:
                                        values["bases"][i - 1] = entry

                # Add FastQC data to samples collection
                streams = {
                    1: "left",
                    2: "right"
                }

                fastqc[streams[suffix]] = values

            # No suffix of 2 will be present for single-end samples
            except IOError:
                pass

        stat_dict = {
            "fastqc": fastqc,
            "_id": self.sample_id
        }

        self.collection_operation("samples", "set_stats", stat_dict)

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
        self.collection_operation("samples", "_remove_sample", [self.sample_id])


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
