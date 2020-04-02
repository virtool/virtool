"""
Functions for parsing FastQC results and running FastQC processes.

"""
import os
import shutil

import virtool.utils


def parse_fastqc(fastqc_path: str, sample_path: str, prefix="fastqc_"):
    """
    Parse the FastQC results at `fastqc_path`.

    All FastQC data except the textual data file are removed. The `prefix` will be prepended to the data file name.

    :param fastqc_path: the FastQC output data path
    :param sample_path: the FastQC text output file will be moved here
    :param prefix: a prefix to prepend to the retained FastQC data file
    :return: a dict containing a representation of the parsed FastQC data

    """
    # Get the text data files from the FastQC output
    for name in os.listdir(fastqc_path):
        if "reads" in name and "." not in name:
            suffix = name.split("_")[1]
            shutil.move(
                os.path.join(fastqc_path, name, "fastqc_data.txt"),
                os.path.join(sample_path, f"{prefix}{suffix}.txt")
            )

    # Dispose of the rest of the data files.
    shutil.rmtree(fastqc_path)

    fastqc = {
        "count": 0
    }

    # Parse data file(s)
    for suffix in [1, 2]:
        path = os.path.join(sample_path, f"{prefix}{suffix}.txt")

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


def handle_base_quality_nan(split_line: list) -> list:
    """
    Parse a per-base quality line containing NaN values.

    :param split_line: the quality line split into a List
    :return: replacement values

    """
    values = split_line[1:]

    for value in values:
        try:
            value = round(int(value.split(".")[0]), 2)
            return [value for _ in values]
        except ValueError:
            pass

    # Return all zeroes if none of the quality values are numbers.
    if set(values) == {"NaN"}:
        return [0] * 4

    joined = ",".join(split_line)

    raise ValueError(f"Could not parse base quality values '{joined}'")
