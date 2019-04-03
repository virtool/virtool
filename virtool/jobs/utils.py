import os
import shutil

import virtool.db.caches
import virtool.db.samples
import virtool.samples
import virtool.utils


def get_cache(db, sample_id, program, parameters):
    document = db.caches.find_one({
        "sample.id": sample_id,
        "program": program,
        "hash": virtool.db.caches.calculate_cache_hash(parameters)
    })

    if document:
        return virtool.utils.base_processor(document)


def get_cache_path(settings, cache_id):
    return os.path.join(settings["data_path"], "caches", cache_id)


def get_cache_read_path(settings, cache_id, suffix):
    cache_path = get_cache_path(settings, cache_id)
    return os.path.join(cache_path, f"reads_{suffix}.fq.gz")


def get_cache_read_paths(settings, cache):
    if not cache:
        return None

    if cache["paired"]:
        return [
            get_cache_read_path(settings, cache["id"], 1),
            get_cache_read_path(settings, cache["id"], 2)
        ]

    return [get_cache_read_path(settings, cache["id"], 1)]


def get_legacy_read_path(sample_path, suffix):
    return os.path.join(sample_path, f"reads_{suffix}.fastq")


def get_legacy_read_paths(settings, sample):
    sample_path = virtool.db.samples.get_sample_path(settings, sample["_id"])

    if not all(f["raw"] for f in sample["files"]):
        if sample["paired"]:
            return [
                get_legacy_read_path(sample_path, 1),
                get_legacy_read_path(sample_path, 2)
            ]

        return [get_legacy_read_path(sample_path, 1)]


def get_read_path(sample_path, suffix):
    return os.path.join(sample_path, f"reads_{suffix}.fq.gz")


def get_untrimmed_read_paths(settings: dict, sample_id: str, paired: bool):
    """
    Returns a one or two item list of file paths for a given sample. Returns `None` if no files are available.

    :param settings: the application settings
    :param sample_id: the id of the sample to get paths for
    :param paired: return left and right read paths
    :return: one or two (paired) read file paths

    """
    sample_path = virtool.db.samples.get_sample_path(settings, sample_id)

    if paired:
        return [
            get_read_path(sample_path, 1),
            get_read_path(sample_path, 2)
        ]

    return [get_read_path(sample_path, 1)]


def get_trimming_command(cache_path: str, parameters: dict, proc, read_paths):
    command = [
        "skewer",
        "-r", str(parameters["max_error_rate"]),
        "-d", str(parameters["max_indel_rate"]),
        "-m", str(parameters["mode"]),
        "-l", str(parameters["min_length"]),
        "-q", str(parameters["end_quality"]),
        "-Q", str(parameters["mean_quality"]),
        "-t", str(proc),
        "-o", os.path.join(cache_path, "reads"),
        "-n",
        "-z",
        "--quiet"
    ]

    if parameters["max_length"]:
        command += [
            "-L", str(parameters["max_length"]),
            "-e"
        ]

    command += read_paths

    return command


def get_trimming_parameters(paired: bool, srna: bool):
    parameters = dict(virtool.samples.TRIM_PARAMETERS)

    if srna:
        parameters.update({
            "min_length": 20,
            "max_length": 22
        })

    if paired:
        parameters["mode"] = "any"

    return parameters


def handle_base_quality_nan(split):
    values = split[1:]

    for value in split[1:]:
        try:
            value = round(int(value.split(".")[0]), 2)
            return [value for _ in values]
        except ValueError:
            pass

    raise ValueError("Could not parse base quality values")


def move_trimming_results(path, paired):
    if paired:
        shutil.move(
            os.path.join(path, "reads-trimmed-pair1.fastq.gz"),
            os.path.join(path, "reads_1.fq.gz")
        )

        shutil.move(
            os.path.join(path, "reads-trimmed-pair2.fastq.gz"),
            os.path.join(path, "reads_2.fq.gz")
        )

    else:
        shutil.move(
            os.path.join(path, "reads-trimmed.fastq.gz"),
            os.path.join(path, "reads_1.fq.gz")
        )

    shutil.move(
        os.path.join(path, "reads-trimmed.log"),
        os.path.join(path, "trim.log")
    )


def parse_fastqc(fastqc_path, sample_path):
    # Get the text data files from the FastQC output
    for name in os.listdir(fastqc_path):
        if "reads" in name and "." not in name:
            suffix = name.split("_")[1]
            shutil.move(
                os.path.join(fastqc_path, name, "fastqc_data.txt"),
                os.path.join(sample_path, f"fastqc_{suffix}.txt")
            )

    # Dispose of the rest of the data files.
    shutil.rmtree(fastqc_path)

    fastqc = {
        "count": 0
    }

    # Parse data file(s)
    for suffix in [1, 2]:
        path = os.path.join(sample_path, f"fastqc_{suffix}.txt")

        try:
            handle = open(path, "r")
        except IOError:
            if suffix == 2:
                continue
            else:
                raise

        flag = None

        for line in handle:
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
                split_length = [int(s) for s in line.split("\t")[1].split('-')]

                if suffix == 1:
                    if len(split_length) == 2:
                        fastqc["length"] = split_length
                    else:
                        fastqc["length"] = [split_length[0], split_length[0]]
                else:
                    fastqc_min_length, fastqc_max_length = fastqc["length"]

                    if len(split_length) == 2:
                        fastqc["length"] = [
                            min(fastqc_min_length, split_length[0]),
                            max(fastqc_max_length, split_length[1])
                        ]
                    else:
                        fastqc["length"] = [
                            min(fastqc_min_length, split_length[0]),
                            max(fastqc_max_length, split_length[0])
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
                try:
                    values = [round(int(value.split(".")[0]), 1) for value in split[1:]]

                except ValueError as err:
                    if "NaN" in str(err):
                        values = handle_base_quality_nan(split)

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
                        fastqc[flag][i - 1] = virtool.utils.average_list(fastqc[flag][i - 1], values)

            elif flag == "sequences" and "#" not in line:
                line = line.rstrip().split()

                quality = int(line[0])

                fastqc["sequences"][quality] += int(line[1].split(".")[0])

    return fastqc


def run_fastqc(run_subprocess, proc, read_paths, fastqc_path):
    command = [
        "fastqc",
        "-f", "fastq",
        "-o", fastqc_path,
        "-t", str(proc),
        "--extract",
        *read_paths
    ]

    run_subprocess(command)
