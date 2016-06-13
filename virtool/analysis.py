import os

import virtool.job
import virtool.utils
import virtool.pathoscope


class Analyze(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.analysis_id = self.task_args["analysis_id"]
        self.sample_id = self.task_args["sample_id"]

        # Get a connection to the virtool database
        self.log("Setting up database connection")
        self.database = virtool.utils.get_db_client(self.settings, sync=True)

        # Get the sample document and the subtraction host document.
        self.sample = self.database["samples"].find_one({"_id": self.sample_id})

        self.host = self.database["hosts"].find_one({"_id": self.sample["subtraction"]})

        # Get the number of reads in the library.
        self.read_count = int(self.sample["quality"]["left"]["count"])

        if self.sample["paired"]:
            self.read_count *= 2

        # Construct path strings that will be used by the job to access relevant files.
        self.paths = dict()

        # The path to the general data directory
        self.paths["data"] = self.settings["data_path"]

        # The parent folder for all data associated with the sample
        self.paths["sample"] = os.path.join(self.paths["data"], "samples/sample_" + self.sample_id)

        # The path the the Bowtie2 reference for all plant viruses
        self.paths["viruses"] = os.path.join(
            self.paths["data"],
            "reference/viruses",
            self.task_args["index_id"],
            "reference"
        )

        # The path to the index of the subtraction host for the sample.
        self.paths["host"] = os.path.join(
            self.paths["data"],
            "reference/hosts/index",
            self.sample["subtraction"].lower().replace(" ", "_"),
            "reference"
        )

        # The path to the directory where all analysis result files will be written.
        self.paths["analysis"] = os.path.join(self.paths["sample"], "analysis", self.analysis_id)

        self.intermediate = dict()
        self.results = dict()

        self.stage_list = [
            self.mk_analysis_dir,
            self.map_viruses,
            self.identify_candidate_viruses
        ]

        if self.task_args["algorithm"] == "pathoscope":
            self.stage_list += [
                self.generate_isolate_fasta,
                self.build_isolate_index,
                self.map_isolates,
                self.map_host,
                self.subtract_virus_mapping,
                self.pathoscope,
                self.import_results
            ]
        else:
            self.stage_list += [
                self.generate_sigma_reference,
                self.sigma_alignment
            ]

    def on_complete(self):
        pass

    def generate_sigma_reference(self):
        ref_path = os.path.join(self.paths["analysis"], "ref")

        os.mkdir(ref_path)

        total_isolate_count = sum([len(virus["isolates"]) for virus in self.intermediate["candidates"]])
        built_isolate_count = 0
        last_reported_progress = 0

        for virus in self.intermediate["candidates"]:

            for isolate in virus["isolates"]:
                # Make a dir for the isolate.
                isolate_path = os.path.join(ref_path, isolate["isolate_id"])
                os.mkdir(isolate_path)

                # Make a path for the index FASTA file and the Bowtie2 index prefix.
                index_path = os.path.join(isolate_path, isolate["isolate_id"])
                fasta_path = index_path + ".fa"

                with open(fasta_path, "w") as fasta:
                    for sequence in isolate["sequences"]:
                        assert len(sequence["sequence"]) > 0
                        fasta.write(">{}\n{}\n".format(sequence["_id"], sequence["sequence"]))

                self.run_process(['bowtie2-build', fasta_path, index_path])

                built_isolate_count += 1

                stage_progress = built_isolate_count / total_isolate_count

                if stage_progress - last_reported_progress > 0.5:
                    self.update_stage_progress(stage_progress)

    def sigma_alignment(self):
        files = self.paths["sample"] + "/reads_1.fastq"

        if self.sample["paired"]:
            files += ("," + self.paths["sample"] + "/reads_2.fastq")

        indexes = os.listdir(os.path.join(self.paths["analysis"], "ref"))

        alignment_path = os.listdir(os.path.join(self.paths["analysis"], "sigma_alignments_output"))

        index_count = 0

        for index in indexes:
            index_path = os.path.join(self.paths["analysis"], "ref", index)

            command = [
                "bowtie2",
                "-p", str(self.proc),
                "--very-fast-local",
                "--no-unal"
                "-x", index_path,
                "-U", files,
                "-S", os.path.join(alignment_path, index + ".sam")
            ]

            self.run_process(command)

            index_count += 1

            self.update_stage_progress(index_count / len(indexes))

    def mk_analysis_dir(self):
        """ Make a directory for RSEM files within the sample directory """
        os.mkdir(self.paths["analysis"])
        self.log("Made analysis directory")

    def map_viruses(self):
        """ Returns a list that defines a Bowtie2 command to map the sample reads against the virus index """
        files = self.paths["sample"] + "/fart.fastq"

        if self.sample["paired"]:
            files += ("," + self.paths["sample"] + "/reads_2.fastq")

        command = [
            "bowtie2",
            "-p", str(self.proc),
            "--local",
            "--score-min", "L,20,1.0",
            "-N", "0",
            "-L", "15",
            "-x", self.paths["viruses"],
            "--al", self.paths["analysis"] + "/mapped.fastq",
            "-U", files
        ]

        # Run the Bowtie2 command append all STDOUT to a list for use in later stages.
        self.intermediate["to_viruses_count"] = 0
        self.intermediate["last_reported_progress"] = 0
        self.intermediate["to_viruses"] = list()

        self.run_process(command, stdout_handler=self.map_virus_handler)

        # Log how many lines of output were generated by Bowtie2
        self.log("Bowtie2 generated " + str(len(self.intermediate["to_viruses"])) + " lines.")

    def map_virus_handler(self, line):
        if not line["data"][0] == "@":
            self.intermediate["to_viruses_count"] += 1

            stage_progress = self.intermediate["to_viruses_count"] / self.read_count

            if (stage_progress - self.intermediate["last_reported_progress"]) > 0.05:
                self.update_stage_progress(stage_progress)
                self.intermediate["last_reported_progress"] = stage_progress

            if line["data"][3] == "*":
                return

        self.intermediate["to_viruses"].append(line)

    def identify_candidate_viruses(self):
        """
        Identify the viruses that were found in the alignment to the default isolates Bowtie2 index. Determine if an
        isolate-level analysis should be performed because one or more of the candidates has more than one isolate.

        """
        # Parse the SAM lines from the previous stage.
        sam = virtool.pathoscope.sam.Parse(self.intermediate["to_viruses"])

        # Get the accessions of the viral sequences that were hit.
        accessions = sam.genomes()

        # Create a dict mapping isolate ids to the ids of their parent viruses
        aggregated = self.database.viruses.aggregate([
            {"$unwind": "$isolates"},
            {"$project": {
                "_id": "$isolates.isolate_id",
                "virus_id": "$_id"
            }}
        ])

        isolate_to_virus = {entry["_id"]: entry["virus_id"] for entry in aggregated["result"]}

        viruses = dict()

        for sequence_entry in self.database.sequences.find({"_id": {"$in": accessions}}):
            # Get the virus and isolate ids associated with the sequence.
            isolate_id = sequence_entry["isolate_id"]
            virus_id = isolate_to_virus[isolate_id]

            if virus_id not in viruses:
                virus = self.database.viruses.find_one({"_id": virus_id})

                for isolate in virus["isolates"]:
                    isolate_sequences = self.database.sequences.find({"isolate_id": isolate["isolate_id"]})
                    isolate["sequences"] = list(isolate_sequences)
                    isolate.pop("sequence_count")

                viruses[virus_id] = virus

        # Check if any of the viruses have more than one isolate associated with them.
        self.intermediate["use_isolates"] = False

        viruses = [virus for virus in viruses.values()]

        for virus in viruses:
            if len(virus["isolates"]) > 1:
                self.intermediate["use_isolates"] = True
                break

        self.intermediate["candidates"] = None

        if self.intermediate["use_isolates"] or self.task_args["algorithm"] == "sigma":
            # Save all of the candidate virus information to the intermediate attribute
            self.intermediate["candidates"] = viruses

    def generate_isolate_fasta(self):
        if self.intermediate["use_isolates"]:
            self.log("Generating isolate FASTA file.")

            with open(self.paths["analysis"] + "/isolate_index.fa", "w") as fasta_file:
                for virus in self.intermediate["candidates"]:
                    for isolate in virus["isolates"]:
                        for sequence in isolate["sequences"]:
                            fasta_file.write(">{}\n{}\n".format(sequence["_id"], sequence["sequence"]))

            self.log("Wrote isolate FASTA file")
        else:
            self.log("Not generating isolate FASTA file.")

    def build_isolate_index(self):
        if self.intermediate["use_isolates"]:
            command = [
                "bowtie2-build",
                self.paths["analysis"] + "/isolate_index.fa",
                self.paths["analysis"] + "/isolates"
            ]
            self.run_process(command)
        else:
            self.log("Not generating isolate index")

    def map_isolates(self):
        if self.intermediate["use_isolates"]:
            self.log("Mapping to isolates")
            files = self.paths["sample"] + "/reads_1.fastq"

            if self.sample["paired"]:
                files += ("," + self.paths["sample"] + "/reads_2.fastq")

            command = [
                "bowtie2",
                "-p", str(self.proc - 1),
                "--no-unal",
                "--local",
                "--score-min", "L,20,1.0",
                "-N", "0",
                "-L", "15",
                "-k", "100",
                "--al", self.paths["analysis"] + "/mapped.fastq",
                "-x", self.paths["analysis"] + "/isolates",
                "-U", files
            ]

            self.log("Clearing default virus mappings")
            self.intermediate["to_viruses"] = None

            # Run the Bowtie2 command append all STDOUT to a list for use in later stages.
            self.intermediate["to_isolates"] = list()
            self.run_process(command, stdout_handler=self.intermediate["to_isolates"].append)

            with open(self.paths["analysis"] + "/isolates.sam", "w") as isolate_sam_file:
                for sam_entry in self.intermediate["to_isolates"]:
                    isolate_sam_file.write(sam_entry["data"] + "\n")

            # Parse the SAM lines from the previous stage
            sam = virtool.pathoscope.sam.Parse(self.intermediate["to_isolates"])

            # Find and log the candidate genome accessions
            accessions = sam.genomes()

            # Log how many lines of output were generated by Bowtie2
            self.log("Bowtie2 generated " + str(len(self.intermediate["to_isolates"])) + " lines.")

            self.log("SAM file contains " + str(len(sam.reads())) + " alignments")

            self.log("Hit " + str(len(accessions)) + "isolate references.")
        else:
            self.log("Not mapping to isolates")

    def map_host(self):
        self.log("Mapping to hosts")

        command = [
            "bowtie2",
            "--local",
            "-N", "0",
            "-p", str(self.proc - 1),
            "-x", self.paths["host"],
            "-U", self.paths["analysis"] + "/mapped.fastq"
        ]

        self.intermediate["to_host"] = list()

        self.run_process(command, stdout_handler=self.intermediate["to_host"].append)

        self.log("Bowtie2 generated " + str(len(self.intermediate["to_host"])) + " lines.")

    def subtract_virus_mapping(self):
        if self.intermediate["use_isolates"]:
            self.log("Subtracting host reads from isolate-level alignment")
            target = self.intermediate["to_isolates"]
        else:
            self.log("Subtracting host reads from virus-level alignment")
            target = self.intermediate["to_viruses"]

        self.intermediate["subtracted"], subtraction_count = virtool.pathoscope.subtract.run(
            [entry["data"] for entry in target],
            [entry["data"] for entry in self.intermediate["to_host"]]
        )

        self.log(str(subtraction_count) + " reads eliminated as host reads")
        self.log("Kept " + str(len(self.intermediate["subtracted"])) + " SAM lines as viral reads")

    def pathoscope(self):
        no_lines = True

        for line in self.intermediate["subtracted"]:
            if not line.startswith("@"):
                no_lines = False

        if not no_lines:
            diagnosis, read_count, self.intermediate["reassigned"] = virtool.pathoscope.reassign.run(
                self.intermediate["subtracted"],
                self.paths["analysis"] + "/pathoscope.tsv",
                self.paths["analysis"] + "/final.sam",
                rewrite_sam=True
            )

            self.results["read_count"] = read_count

            cleaned = dict()

            for entry in diagnosis:
                genome_id = entry["genome"]
                final = entry["final"]

                sequence_entry = self.database["sequences"].find_one({"_id": genome_id}, {"isolate_id": True})

                minimal_virus = self.database["viruses"].find_one(
                    {"isolates.isolate_id": sequence_entry["isolate_id"]},
                    {"_id": True, "_version": True}
                )

                cleaned[genome_id] = {key: final[key] for key in ["pi", "best", "reads"]}

                cleaned[genome_id].update({
                    "virus_version": minimal_virus["_version"],
                    "virus_id": minimal_virus["_id"]
                })

            self.results["diagnosis"] = cleaned
        else:
            self.results = {
                "diagnosis": {},
                "read_count": 0
            }

            self.intermediate["reassigned"] = []

        self.log(str(len(self.intermediate["reassigned"])) + " lines retained after reassignment")

    def import_results(self):
        genome_ids = list(self.results["diagnosis"].keys())
        minimal_sequences = self.database["sequences"].find({"_id": {"$in": genome_ids}})

        lengths = {entry["_id"]: len(entry["sequence"]) for entry in minimal_sequences}

        if self.results["diagnosis"]:
            coverage = virtool.pathoscope.sam.coverage(
                self.intermediate["reassigned"],
                lengths
            )

            for ref_id in coverage:
                for key in coverage[ref_id]:
                    try:
                        self.results["diagnosis"][ref_id][key] = coverage[ref_id][key]
                    except KeyError:
                        pass

        self.collection_operation("samples", "set_analysis", {
            "_id": self.sample_id,
            "analysis_id": self.analysis_id,
            "analysis": self.results
        })

        self.collection_operation("indexes", "cleanup_index_files")

    def cleanup(self):
        # Remove changes to sample entry in database that occurred during the failed analysis process
        self.collection_operation("samples", "_remove_analysis", {
            "_id": self.sample_id,
            "analysis_id": self.analysis_id
        })
