import os
import json
import pprint
import random
import collections

class Annotations:

    def __init__(self, directory):
        self.directory = directory
        self.documents = {}
        self.backup = {}

        self.load_from_directory()

    def load_from_directory(self):
        paths = os.listdir(self.directory)
        self.documents = {}

        for path in paths:
            document = {"entries": []}

            with open(self.directory + "/" + path, "r") as vfam_file:
                for line in vfam_file:
                    line = line.rstrip()
                    data = " ".join(line.split()[1:])

                    if line.startswith("CLUSTER"):
                        document["_id"] = int(data)

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

            self.documents[document["_id"]] = document

        self.backup = dict(self.documents)

    def revert(self):
        self.documents = dict(self.backup)

    def guess_definitions(self):
        for _id, document in self.documents.items():
            names = [entry["name"] for entry in document["entries"]]
            top_three = collections.Counter(names).most_common(3)
            top_names = [entry[0] for entry in top_three]
            document["definition"] = ", ".join(top_names)
            self.documents[_id] = document

    def print_one(self):
        try:
            _id = random.randrange(1, len(self.documents))
            pprint.pprint(self.documents[_id])
        except KeyError:
            self.print_one()

    def find(self, _id):
        return self.documents[int(_id)]

    def write_to_dat(self, path):

        with open(path, "w") as dat_file:
            for _id, document in self.documents.items():
                comment = "Families: " + str(document["families"])
                entry = {
                    "AC": "PB" + str(document["_id"]),
                    "ID": "vFam" + str(document["_id"]),
                    "DE": document["definition"],
                    "AU": "igboyes",
                    "SE": "none",
                    "GA": str(document["mean_entropy"]),
                    "TC": "none",
                    "NC": "none",
                    "TP": "Family",
                    "SQ": str(document["count"]),
                    "CC": comment
                }

                dat_file.write("# MUSCLE 3.38\n")

                for key, value in entry.items():
                    dat_file.write("#=GF " + key + "\t" + value + "\n")

                dat_file.write("//\n")