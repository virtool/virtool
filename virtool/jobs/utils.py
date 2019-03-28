import os

import virtool.db.caches
import virtool.db.samples
import virtool.utils


def get_cache(db, sample_id, program, parameters):
    document = db.caches.find_one({
        "sample.id": sample_id,
        "program": program,
        "hash": virtool.db.caches.calculate_cache_hash(parameters)
    })

    if document:
        return virtool.utils.base_processor(document)


def get_cache_read_path(settings, cache_id, suffix):
    return os.path.join(settings["data_path"], "caches", cache_id, f"reads_{suffix}.fq.gz")



def get_legacy_read_path(sample_path, suffix):
    return os.path.join(sample_path, f"reads_{suffix}.fastq")


def get_read_paths(db, settings: dict, sample_id: str, program: str, parameters: dict):
    """
    Returns a one or two item list of file paths for a given sample. Returns `None` if no files are available.

    :param db: the application database client
    :param settings: the application settings
    :param sample_id: the id of the sample to get paths for
    :param program: the trimming program to match caches with
    :param parameters: the trimming parameters to matches caches with
    :return: one or two (paired) read file paths

    """
    cache = get_cache(db, sample_id, program, parameters)

    if cache:
        if cache["paired"]:
            return [
                get_cache_read_path(settings, cache["id"], 1),
                get_cache_read_path(settings, cache["id"], 2)
            ]

        return [get_cache_read_path(settings, cache["id"], 1)]

    document = db.find_one(sample_id, ["files"])

    paired = document["paired"]

    sample_path = virtool.db.samples.get_sample_path(settings, sample_id)

    if not all(f["raw"] for f in document["files"]):
        if paired:
            return [
                get_legacy_read_path(sample_path, 1),
                get_legacy_read_path(sample_path, 2)
            ]

        return [get_legacy_read_path(sample_path, 1)]


def get_command(params):
    mode = "normal"



    parameters = get_parameters()



    command = [
        "skewer",
        "-m", "pe" if params["paired"] else "any",
        "-l", "20" if params["srna"] else "50",
        "-q", "20",
        "-Q", "25",
        "-t", str(self.proc),
        "-o", os.path.join(params["sample_path"], "reads"),
        "--quiet"
    ]

        input_paths = [os.path.join(self.settings["data_path"], "files", file_id) for file_id in self.params["files"]]



        # Trim reads to max length of 23 if the sample is sRNA.
        if self.params["srna"]:
            command += [
                "-L", "23",
                "-e"
            ]

        command += input_paths

        # Prevents an error from skewer when called inside a subprocess.


def get_parameters(mode=None):
    parameters = {
        "max_error_rate": 0.1,
        "max_indel_rate": 0.03,
        "end_quality": 20,
        "mean_quality": 25,
        "min_length": 50,
        "max_length": None,
        "filter_degenerate": False
    }

    if mode == "barcode":
        return {
            **parameters,
            "end_quality": 12,
            "mean_quality": 15
        }

    if mode == "srna":
        return {
            **parameters,

        }


    return parameters
