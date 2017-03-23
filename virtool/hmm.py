import os
import math
import gzip
import json
import shutil
import subprocess

from collections import Counter

import virtool.gen
import virtool.database
import virtool.utils


class Collection(virtool.database.Collection):

    def __init__(self, dispatch, collections, settings, add_periodic_callback):
        super().__init__("hmm", dispatch, collections, settings, add_periodic_callback)

        self.sync_projector += [
            "cluster",
            "label",
            "count",
            "families"
        ]

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        detail = yield self.find_one({"_id": transaction.data["_id"]})

        if detail:
            return True, detail

        return False, dict(message="Document not found")

    @virtool.gen.exposed_method(["modify_hmm"])
    def import_hmm(self, transaction):
        src_path = os.path.join(self.settings.get("data_path"), "files", transaction.data["file_id"])
        dest_path = os.path.join(self.settings.get("data_path"), "hmm/profiles.hmm")

        shutil.copyfile(src_path, dest_path)

        result = yield self._check_files()

        yield self.collections["status"].update("hmm", {
            "$set": result
        }, upsert=True)

        return True, result

    @virtool.gen.exposed_method(["modify_hmm"])
    def import_annotations(self, transaction):
        annotation_count = yield self.db.count()

        if annotation_count > 0:
            return False, dict(message="Annotations collection is not empty")

        # The file id to import the data from.
        file_id = transaction.data["file_id"]

        with gzip.open(os.path.join(self.settings.get("data_path"), "files", file_id), "rt") as input_file:
            annotations_to_import = json.load(input_file)

        # The number of annotation documents that will be imported.
        count = len(annotations_to_import)

        transaction.update({"count": count})

        # The number of documents to insert at a time.
        chunk_size = int(math.ceil(count * 0.01))

        # A list of documents that have to be inserted when chunk_size is met.
        cache = list()

        for i, annotation in enumerate(annotations_to_import):
            top_three = Counter([entry["name"] for entry in annotation["entries"]]).most_common(3)
            top_names = [entry[0] for entry in top_three]

            new_id = yield self.get_new_id()

            annotation.update({
                "_id": new_id,
                "definition": top_names,
                "label": top_names[0],
                "_version": 0
            })

            cache.append(annotation)

            if len(cache) == chunk_size or i == count - 1:
                self.db.insert_many(cache)
                yield self.dispatch("update", [{key: d[key] for key in self.sync_projector} for d in cache])
                cache = []

        yield self._check_files()

        return True, None

    @virtool.gen.exposed_method([])
    def check_files(self, transaction):
        result = yield self._check_files()

        yield self.collections["status"].update("hmm", {
            "$set": result
        }, upsert=True)

        return True, result

    @virtool.gen.coroutine
    def _check_files(self):
        hmm_dir_path = os.path.join(self.settings.get("data_path"), "hmm")

        result = {
            "files": list(),
            "errors": {
                "hmm_dir": False,
                "hmm_file": False,
                "press": False,
                "not_in_file": False,
                "not_in_database": False
            }
        }

        if not os.path.isdir(hmm_dir_path):
            result["errors"]["hmm_dir"] = True
            return result

        hmm_file_path = os.path.join(hmm_dir_path, "profiles.hmm")

        if not os.path.isfile(hmm_file_path):
            result["errors"]["hmm_file"] = True
            return result

        if not all(os.path.isfile(hmm_file_path + ".h3" + suffix) for suffix in ["f", "i", "m", "p"]):
            result["errors"]["press"] = True

        hmm_stats = yield hmmstat(hmm_file_path)

        annotations = yield self.db.find({}, {
            "cluster": True,
            "count": True,
            "length": True
        }).to_list(None)

        clusters_in_file = {entry["cluster"] for entry in hmm_stats}
        clusters_in_database = {entry["cluster"] for entry in annotations}

        # Calculate which cluster ids are unique to the HMM file and/or the annotation database.
        result["errors"]["not_in_file"] = list(clusters_in_database - clusters_in_file) or False
        result["errors"]["not_in_database"] = list(clusters_in_file - clusters_in_database) or False

        files = yield virtool.utils.list_files(hmm_dir_path)

        result["files"] = sorted(filename for filename in files if ".hmm" in filename)

        return result

    @virtool.gen.exposed_method(["modify_hmm"])
    def clean(self, transaction):
        results = yield self._check_files()

        if results["errors"]["not_in_file"]:
            hmm_ids = yield self.find({"cluster": {
                "$in": results["errors"]["not_in_file"]
            }}).distinct("_id")

            result = yield self.remove(hmm_ids)

            yield self._check_files()

            return True, result

        return False, dict(message="No problems found")

    @virtool.gen.exposed_method(["modify_hmm"])
    def set_field(self, transaction):
        if transaction.data["field"] != "label":
            return False, dict(message="Not allowed to set this field.")

        yield self.update(transaction.data["_id"], {
            "$set": {
                transaction.data["field"]: transaction.data["value"]
            }
        })

        return True, None


@virtool.gen.synchronous
def hmmstat(hmm_file_path):
    if not os.path.isfile(hmm_file_path):
        raise FileNotFoundError("HMM file does not exist")

    output = subprocess.check_output(["hmmstat", hmm_file_path])

    result = [line.split() for line in output.decode("utf-8").split("\n") if line and line[0] != "#"]

    return [{
        "cluster": int(line[1].replace("vFam_", "")),
        "count": int(line[3]),
        "length": int(line[5])
    } for line in result]


@virtool.gen.synchronous
def hmmpress(hmm_file_path):
    if not os.path.isfile(hmm_file_path):
        raise FileNotFoundError("HMM file does not exist")

    return subprocess.check_output(["hmmpress", "-f", hmm_file_path])


def vfam_text_to_json(annotation_path, output_path=None):
    paths = os.listdir(annotation_path)

    annotations = list()

    for path in paths:
        document = {"entries": []}

        with open(os.path.join(annotation_path, path), "r") as vfam_file:
            for line in vfam_file:

                line = line.rstrip()
                data = " ".join(line.split()[1:])

                if line.startswith("CLUSTER"):
                    document["cluster"] = int(data)

                if line.startswith("NUM_SEQ"):
                    document["count"] = int(data)

                if line.startswith("LENGTH"):
                    document["length"] = int(data)

                if line.startswith("RELATIVE_ENTROPY"):
                    document["mean_entropy"] = float(data)

                if line.startswith("TOTAL_RELATIVE"):
                    document["total_entropy"] = float(data)

                if line.startswith("FAMILIES"):
                    document["families"] = json.loads(data.replace("'", '"'))

                if line.startswith("GENERA"):
                    document["genera"] = json.loads(data.replace("'", '"'))

                if line.startswith("FASTA"):
                    continue

                if "|" in line:
                    line = line.split("|")
                    name_field = line[5].split("[")

                    document["entries"].append({
                        "gi": line[1],
                        "accession": line[3],
                        "name": name_field[0].strip(),
                        "organism": name_field[1].replace("]", "").strip()
                    })

        annotations.append(document)

    if output_path:
        with gzip.open(output_path, "wt") as output:
            json.dump(annotations, output)

    return annotations
