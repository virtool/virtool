import os
import gzip
import json
import collections

import virtool.gen
import virtool.database

class Collection(virtool.database.Collection):

    def __init__(self, dispatcher):
        super().__init__("hmm", dispatcher)

        self.sync_projector.update({field: True for field in [
            "cluster",
            "label",
            "count",
            "families"
        ]})

    @virtool.gen.exposed_method([])
    def detail(self, transaction):
        detail = yield self.find_one({"_id": transaction.data["_id"]})
        return True, detail

    @virtool.gen.exposed_method(["modify_hmm"])
    def import_data(self, transaction):
        annotation_count = yield self.db.count()

        if annotation_count > 0:
            return False, dict(message="Cannot import annotation when one or more annotations already exist.")

        # The file id to import the data from.
        file_id = transaction.data["file_id"]

        inserted_count = 0

        # Load a list of joined virus from a the gzip-compressed JSON.
        with gzip.open(os.path.join(self.settings.get("data_path"), "upload", file_id), "rt") as input_file:
            annotations_to_import = json.load(input_file)

        for annotation in annotations_to_import:
            top_three = collections.Counter([entry["name"] for entry in annotation["entries"]]).most_common(3)
            top_names = [entry[0] for entry in top_three]

            new_id = yield self.get_new_id()

            annotation.update({
                "_id": new_id,
                "definition": top_names,
                "label": top_names[0],
                "_version": 0
            })

            inserted_count += 1

            yield self.insert(annotation)

        return True, {"count": inserted_count}

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

def text_to_json(annotation_path):
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

    with gzip.open("annotations.json.gz", "wt") as output:
        json.dump(annotations, output)