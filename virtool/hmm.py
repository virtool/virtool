import os
import gzip
import json
import subprocess
import virtool.utils

projection = [
    "_id",
    "_version",
    "cluster",
    "label",
    "count",
    "families"
]


def to_client(document):
    document["hmm_id"] = document.pop("_id")
    return document


def to_dispatcher(document):
    return to_client(document)


async def check(db, settings):

    hmm_dir_path = os.path.join(settings.get("data_path"), "hmm")

    errors = {
        "hmm_file": False,
        "not_in_file": False,
        "not_in_database": False
    }

    if not os.path.isdir(hmm_dir_path):
        os.mkdir(hmm_dir_path)

    hmm_file_path = os.path.join(hmm_dir_path, "profiles.hmm")

    if os.path.isfile(hmm_file_path):
        hmm_stats = await hmmstat(hmm_file_path)

        annotations = await db.hmm.find({}, {
            "cluster": True,
            "count": True,
            "length": True
        }).to_list(None)

        clusters_in_file = {entry["cluster"] for entry in hmm_stats}
        clusters_in_database = {entry["cluster"] for entry in annotations}

        # Calculate which cluster ids are unique to the HMM file and/or the annotation database.
        errors["not_in_file"] = list(clusters_in_database - clusters_in_file) or False
        errors["not_in_database"] = list(clusters_in_file - clusters_in_database) or False
    else:
        errors["hmm_file"] = True

    await db.status.update("hmm", {
        "$set": errors
    }, upsert=True)

    return errors


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
