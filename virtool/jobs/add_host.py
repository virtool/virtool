import os

from virtool.jobs.job import Job


class AddHost(Job):

    """
    A subclass of :class:`.Job` that adds a new host to Virtool from a passed FASTA file. Job stages are:

    1. mk_host_dir
    2. stats
    3. bowtie_build
    4. update_db

    """

    def __init__(self, *args, **task_args):
        super(AddHost, self).__init__(*args, **task_args)

        #: The id of the host being added. Extracted from :attr:`~.virtool.job.Job.task_args`.
        self.host_id = self.task_args["_id"]

        #: The path to the FASTA file being added as a host reference.
        self.fasta_path = os.path.join(self.settings.get("data_path"), "files", self.task_args["file_id"])

        #: The path to the directory the Bowtie2 index will be written to.
        self.index_path = os.path.join(
            self.settings.get("data_path"),
            "reference/hosts",
            self.host_id.lower().replace(" ", "_")
        )

        #: The job stages.
        self.stage_list = [
            self.mk_host_dir,
            self.stats,
            self.bowtie_build,
            self.snap_build,
            self.update_db
        ]

    def mk_host_dir(self):
        """
        Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

        """
        os.mkdir(self.index_path)

    def stats(self):
        """
        Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
        length distribution, and sequence count.

        """
        nucleotides = {
            "a": 0,
            "t": 0,
            "g": 0,
            "c": 0,
            "n": 0
        }

        count = 0
        length_list = []
        sequence = []

        # Go through the fasta file getting the nucleotide counts, lengths, and number of sequences
        with open(self.fasta_path, "r") as fasta_file:
            for line in fasta_file:
                if line[0] == ">":
                    count += 1

                    if sequence:
                        sequence = "".join(sequence)
                        length_list.append(len(sequence))

                        for i in ["a", "t", "g", "c", "n"]:
                            # Find lowercase and uppercase nucleotide characters
                            nucleotides[i] += sequence.count(i)
                            nucleotides[i] += sequence.count(i.upper())

                        sequence = []

                else:
                    sequence.append(line.rstrip())

        # Calculate the average and total length to be returned at end of function
        lengths = {
            "total": sum(length_list),
            "mean": round(sum(length_list) / len(length_list)),
            "max": max(length_list),
            "min": min(length_list)
        }

        # Reprocess the nucleotides dict to contain ratios for each nucleotide rather than counts
        nucleotides = {i: round(nucleotides[i] / lengths["total"], 3) for i in nucleotides}

        self.collection_operation("hosts", "add_stats", {"_id": self.host_id, "stats": {
            "nucleotides": nucleotides,
            "lengths": lengths,
            "count": count
        }})

    def bowtie_build(self):
        """
        Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

        """
        command = [
            "bowtie2-build",
            "-f",
            self.fasta_path,
            self.index_path + "/reference"
        ]

        self.run_process(command)

    def snap_build(self):
        command = [
            "snap",
            "index",
            self.fasta_path,
            self.index_path,
            "-t" + str(self.proc)
        ]

        self.run_process(command, no_output_failure=True)

    def update_db(self):
        """
        Set the *ready* field to True by calling :meth:`.hosts.Collection.set_added`.

        """
        self.collection_operation("hosts", "set_ready", {"_id": self.host_id})

    def cleanup(self):
        """
        Clean up if the job process encounters an error or is cancelled. Removes the host document from the database.

        """
        self.collection_operation("hosts", "_remove_host", self.host_id)
