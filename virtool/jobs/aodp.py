import os
import shutil
import sys
from collections import defaultdict

from Bio import SeqIO
from Bio.SeqRecord import SeqRecord


import virtool.jobs.analysis
import virtool.utils

AODP_MAX_HOMOLOGY = 0
AODP_OLIGO_SIZE = 8


class Job(virtool.jobs.analysis.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._stage_list = [
            self.make_analysis_dir,
            self.prepare_index,
            self.prepare_reads,
            self.join_reads,
            self.deduplicate_reads,
            self.aodp,
            self.import_results
        ]

        self.results = dict()

    def check_db(self):
        super().check_db()

        self.params["local_index_path"] = os.path.join(self.params["analysis_path"], "reference.fa")
        self.params["aodp_output_path"] = os.path.join(self.params["analysis_path"], "aodp.out")

        self.params["index_path"] = os.path.join(
            self.settings["data_path"],
            "references",
            self.task_args["ref_id"],
            self.task_args["index_id"],
            "ref.fa"
        )

    def prepare_index(self):
        shutil.copy(
            self.params["index_path"],
            self.params["local_index_path"]
        )

    def join_reads(self):
        max_overlap = round(0.65 * self.params["sample_read_length"])
        output_prefix = os.path.join(self.params["analysis_path"], "flash")

        command = [
            "flash",
            "--max-overlap", str(max_overlap),
            "-o", output_prefix,
            "-t", str(self.proc - 1),
            *self.params["read_paths"]
        ]

        self.run_subprocess(command)

        joined_path = f"{output_prefix}.extendedFrags.fastq"
        remainder_path = f"{output_prefix}.notCombined_1.fastq"
        hist_path = f"{output_prefix}.hist"

        self.results = {
            "join_histogram": parse_flash_hist(hist_path),
            "joined_pair_count": virtool.utils.file_length(joined_path) / 4,
            "remainder_pair_count": virtool.utils.file_length(remainder_path) / 4
        }

    def deduplicate_reads(self):
        """
        Remove duplicate reads. Store the counts for unique reads.

        """
        counts = defaultdict(int)

        joined_path = os.path.join(self.params["analysis_path"], "flash.extendedFrags.fastq")
        output_path = os.path.join(self.params["analysis_path"], "unique.fa")

        with open(output_path, "w") as f:
            for record in parse_joined_fastq(joined_path, counts):
                SeqIO.write(record, f, format="fasta")

        self.intermediate["sequence_counts"] = counts

    def aodp(self):
        cwd = self.params["analysis_path"]

        aodp_output_path = self.params["aodp_output_path"]
        base_name = os.path.join(self.params["analysis_path"], "aodp")
        local_index_path = self.params["local_index_path"]
        target_path = os.path.join(self.params["analysis_path"], "unique.fa")

        if cwd[0] != "/":
            cwd = os.path.join(sys.path[0], cwd)

            aodp_output_path = os.path.join(sys.path[0], aodp_output_path)
            base_name = os.path.join(sys.path[0], base_name)
            local_index_path = os.path.join(sys.path[0], self.params["local_index_path"])
            target_path = os.path.join(sys.path[0], target_path)

        command = [
            "aodp",
            f"--basename={base_name}",
            f"--threads={self.proc}",
            f"--oligo-size={AODP_OLIGO_SIZE}",
            f"--match={target_path}",
            f"--match-output={aodp_output_path}",
            f"--max-homolo={AODP_MAX_HOMOLOGY}",
            local_index_path
        ]

        self.run_subprocess(command, cwd=cwd)

        parsed = list()

        with open(self.params["aodp_output_path"], "r") as f:
            for line in f:
                split = line.rstrip().split("\t")
                assert len(split) == 7

                sequence_id = split[1]

                if sequence_id == "-":
                    continue

                identity = split[2]

                if identity[0] == "<":
                    continue
                else:
                    identity = float(identity.replace("%", ""))

                read_id = split[0]

                sequence_id = split[1]

                otu_id = self.params["sequence_otu_map"][sequence_id]
                otu_version = self.params["manifest"][otu_id]

                parsed.append({
                    "id": read_id,
                    "sequence_id": sequence_id,
                    "identity": identity,
                    "matched_length": int(split[3]),
                    "read_length": int(split[4]),
                    "min_cluster": int(split[5]),
                    "max_cluster": int(split[6]),
                    "count": self.intermediate["sequence_counts"][read_id],
                    "otu": {
                        "version": otu_version,
                        "id": otu_id
                    }
                })

        self.results["results"] = parsed

    def import_results(self):
        analysis_id = self.params["analysis_id"]
        sample_id = self.params["sample_id"]

        # Update the database document with the small data.
        self.db.analyses.update_one({"_id": analysis_id}, {
            "$set": {
                **self.results,
                "ready": True
            }
        })

        self.dispatch("analyses", "update", [analysis_id])
        self.dispatch("samples", "update", [sample_id])


def parse_joined_fastq(path: str, counts: defaultdict):
    sequence_id_map = dict()

    for record in SeqIO.parse(path, format="fastq"):
        try:
            sequence_id = sequence_id_map[str(record.seq)]
        except KeyError:
            sequence_id = f"read_{len(sequence_id_map) + 1}"
            sequence_id_map[str(record.seq)] = sequence_id

            yield SeqRecord(record.seq, id=sequence_id)

        counts[sequence_id] += 1


def parse_flash_hist(path):
    hist = list()

    with open(path, "r") as f:
        for line in f:
            hist.append([int(i) for i in line.rstrip().split()])

    return hist
