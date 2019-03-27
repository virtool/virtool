import os
import shutil

import virtool.db.files
import virtool.db.samples
import virtool.jobs.job
import virtool.samples
import virtool.utils


def handle_base_quality_nan(split):
    values = split[1:]

    for value in split[1:]:
        try:
            value = round(int(value.split(".")[0]), 2)
            return [value for _ in values]
        except ValueError:
            pass

    raise ValueError("Could not parse base quality values")


class Job(virtool.jobs.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        #: The ordered list of :ref:`stage methods <stage-methods>` that are called by the job.
        self._stage_list = [
            self.make_sample_dir,
            self.copy_files,
            self.fastqc,
            self.parse_fastqc,
            self.clean_watch
        ]

    def check_db(self):
        self.params = dict(self.task_args)

        self.params["sample_path"] = os.path.join(
            self.settings["data_path"],
            "samples",
            self.params["sample_id"]
        )

        self.params["analysis_path"] = os.path.join(self.params["sample_path"], "analysis")

        self.params.update({
            "fastqc_path": os.path.join(self.params["sample_path"], "fastqc"),
            "paired": len(self.params["files"]) == 2
        })

    def make_sample_dir(self):
        """
        Make a data directory for the sample and a subdirectory for analyses. Read files, quality data from FastQC, and
        analysis data will be stored here.

        """

        try:
            os.makedirs(self.params["analysis_path"])
            os.makedirs(self.params["fastqc_path"])
        except OSError:
            # If the path already exists, remove it and try again.
            shutil.rmtree(self.params["sample_path"])
            os.makedirs(self.params["analysis_path"])
            os.makedirs(self.params["fastqc_path"])

    def copy_files(self):
        """
        Copy the files from the files directory to the nascent sample directory.

        """
        sample_id = self.params["sample_id"]
        paired = self.params["paired"]

        raw = list()

        for index, file in enumerate(self.params["files"]):
            path = os.path.join(self.settings["data_path"], "files", file["id"])

            name = f"reads_{index + 1}.fq.gz"

            target = os.path.join(self.params["sample_path"], name)

            if virtool.utils.is_gzipped(path):
                shutil.copyfile(path, target)
            else:
                virtool.utils.compress_file(path, target, processes=self.proc)

            stats = virtool.utils.file_stats(target)

            raw.append({
                "name": name,
                "size": stats["size"],
                "download_url": f"/download/samples/{sample_id}/{name}",
                "raw": True,
                "from": file
            })

        self.db.samples.update_one({"_id": sample_id}, {
            "$set": {
                "files": raw
            }
        })

    def fastqc(self):
        """
        Runs FastQC on the renamed, trimmed read files.

        """
        command = [
            "fastqc",
            "-f", "fastq",
            "-o", self.params["fastqc_path"],
            "-t", str(self.proc),
            "--extract",
            self.params["sample_path"] + "/reads_1.fq.gz"
        ]

        if self.params["paired"]:
            command.append(os.path.join(self.params["sample_path"], "reads_2.fq.gz"))

        self.run_subprocess(command)

    def parse_fastqc(self):
        """
        Capture the desired data from the FastQC output. The data is added to the samples database
        in the main run() method

        """
        # Get the text data files from the FastQC output
        for name in os.listdir(self.params["fastqc_path"]):
            if "reads" in name and "." not in name:
                suffix = name.split("_")[1]
                shutil.move(
                    os.path.join(self.params["fastqc_path"], name, "fastqc_data.txt"),
                    os.path.join(self.params["sample_path"], f"fastqc_{suffix}.txt")
                )

        # Dispose of the rest of the data files.
        shutil.rmtree(self.params["fastqc_path"])

        fastqc = {
            "count": 0
        }

        # Parse data file(s)
        for suffix in [1, 2]:
            path = os.path.join(self.params["sample_path"], f"fastqc_{suffix}.txt")

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

        self.db.samples.update_one({"_id": self.params["sample_id"]}, {
            "$set": {
                "quality": fastqc,
                "imported": False
            }
        })

        self.dispatch("samples", "update", [self.params["sample_id"]])

    def clean_watch(self):
        """ Remove the original read files from the files directory """
        self.db.files.delete_many({"_id": {"$in": self.params["files"]}})
        self.dispatch("files", "delete", self.params["files"])

    def cleanup(self):
        for file_id in self.params["files"]:
            self.db.files.update_many({"_id": file_id}, {
                "$set": {
                    "reserved": False
                }
            })

        self.dispatch("files", "update", self.params["files"])

        try:
            shutil.rmtree(self.params["sample_path"])
        except FileNotFoundError:
            pass

        self.db.samples.delete_one({"_id": self.params["sample_id"]})

        self.dispatch("samples", "delete", [self.params["sample_id"]])
