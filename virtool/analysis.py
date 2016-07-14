import os
import gzip

import virtool.job
import virtool.vfam
import virtool.utils
import virtool.pathoscope

from Bio import SeqIO


class Analyze(virtool.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.sample_id = self.task_args["sample_id"]
        self.analysis_id = self.task_args["analysis_id"]

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

    def calculate_read_path(self):
        files = [self.paths["sample"] + "/reads_1.fastq"]

        if self.sample["paired"]:
            files.append(self.paths["sample"] + "/reads_2.fastq")

        if os.path.isfile(files[0] + ".gz"):
            files = [file_path + ".gz" for file_path in files]

        return ",".join(files)


class Pathoscope(Analyze):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.intermediate = dict()
        self.results = dict()

    def mk_analysis_dir(self):
        """ Make a directory for RSEM files within the sample directory """
        os.mkdir(self.paths["analysis"])
        self.log("Made analysis directory")

    def identify_candidate_viruses(self):
        """
        Identify the viruses that were found in the alignment to the default isolates Bowtie2 index. Determine if an
        isolate-level analysis should be performed because one or more of the candidates has more than one isolate.

        """
        # Get the accessions of the viral sequences that were hit.
        accessions = self.intermediate["to_viruses"].genomes()

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
        else:
            self.log("Not generating isolate FASTA file.")

    def pathoscope(self):
        diagnosis, read_count, self.intermediate["reassigned"] = virtool.pathoscope.reassign.run(
            self.intermediate["to_viruses"],
            self.paths["analysis"] + "/pathoscope.tsv"
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


class PathoscopeBowtie(Pathoscope):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.stage_list += [
            self.mk_analysis_dir,
            self.map_viruses,
            self.identify_candidate_viruses,
            self.generate_isolate_fasta,
            self.build_isolate_index,
            self.map_isolates,
            self.map_host,
            self.subtract_virus_mapping,
            self.pathoscope,
            self.import_results
        ]

    def mk_analysis_dir(self):
        """ Make a directory for RSEM files within the sample directory """
        os.mkdir(self.paths["analysis"])
        self.log("Made analysis directory")

    def map_viruses(self):
        """ Returns a list that defines a Bowtie2 command to map the sample reads against the virus index """
        files = self.calculate_read_path()

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

        to_viruses = virtool.pathoscope.sam.Lines()

        self.run_process(command, no_output_failure=True, stdout_handler=to_viruses.add)

        self.intermediate["to_viruses"] = to_viruses

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

            files = self.calculate_read_path()

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
            to_viruses = virtool.pathoscope.sam.Lines()

            self.run_process(command, no_output_failure=True, stdout_handler=to_viruses.add)

            self.intermediate["to_viruses"] = to_viruses

            # Find and log the candidate genome accessions
            accessions = self.intermediate["to_viruses"].genomes()

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

        to_host = virtool.pathoscope.sam.Lines()

        self.run_process(command, no_output_failure=True, stdout_handler=to_host.add)

        self.intermediate["to_host"] = to_host

    def subtract_virus_mapping(self):
        subtraction_count = virtool.pathoscope.subtract.run(
            self.intermediate["to_viruses"],
            self.intermediate["to_host"]
        )

        self.log(str(subtraction_count) + " reads eliminated as host reads")

    def cleanup(self):
        # Remove changes to sample entry in database that occurred during the failed analysis process
        self.collection_operation("samples", "_remove_analysis", {
            "_id": self.sample_id,
            "analysis_id": self.analysis_id
        })


class PathoscopeSNAP(Pathoscope):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.paths["viruses"] = os.path.join(
            self.paths["data"],
            "reference/viruses",
            self.task_args["index_id"]
        )

        # The path to the index of the subtraction host for the sample.
        self.paths["host"] = os.path.join(
            self.paths["data"],
            "reference/hosts/index",
            self.sample["subtraction"].lower().replace(" ", "_")
        )

        self.stage_list += [
            self.mk_analysis_dir,
            self.map_viruses,
            self.identify_candidate_viruses,
            self.generate_isolate_fasta,
            self.build_isolate_index,
            self.map_isolates,
            self.save_mapped_reads,
            self.map_host,
            self.subtract_virus_mapping,
            self.pathoscope,
            self.import_results
        ]

    def mk_analysis_dir(self):
        """ Make a directory for RSEM files within the sample directory """
        os.mkdir(self.paths["analysis"])
        self.log("Made analysis directory")

    def map_viruses(self):
        """ Returns a list that defines a Bowtie2 command to map the sample reads against the virus index """
        files = self.calculate_read_path()

        command = [
            "snap",
            "single",
            self.paths["viruses"],
            files,
            "-t", str(self.proc - 1),
            # Aligned output only
            "-F", "a",
            # Output to STDOUT
            "-o", "-sam", "-"
        ]

        to_viruses = virtool.pathoscope.sam.Lines(snap=True)

        self.run_process(command, no_output_failure=True, stdout_handler=to_viruses.add)

        self.intermediate["to_viruses"] = to_viruses

    def build_isolate_index(self):
        if self.intermediate["use_isolates"]:
            command = [
                "snap",
                "index",
                self.paths["analysis"] + "/isolate_index.fa",
                self.paths["analysis"],
                "-t" + str(self.proc)
            ]

            self.run_process(command)
        else:
            self.log("Not generating isolate index")

    def map_isolates(self):
        if self.intermediate["use_isolates"]:
            self.log("Mapping to isolates")

            files = self.calculate_read_path()

            command = [
                "snap",
                "single",
                self.paths["analysis"],
                files,
                "-t", str(self.proc - 1),
                # Aligned output only
                "-F", "a",
                # Max edit distance
                "-d", "7",
                # Output multiple alignments
                "-om", "2",
                # Output only 50 multi-maps per read
                "-omax", "50",
                # Output to STDOUT
                "-o", "-sam", "-",
            ]

            del self.intermediate["to_viruses"]

            # Run the Bowtie2 command append all STDOUT to a list for use in later stages.
            to_viruses = virtool.pathoscope.sam.Lines(snap=True)

            self.run_process(command, no_output_failure=True, stdout_handler=to_viruses.add)

            self.intermediate["to_viruses"] = to_viruses

            # Find and log the candidate genome accessions
            accessions = self.intermediate["to_viruses"].genomes()

            self.log("Hit " + str(len(accessions)) + "isolate references.")
        else:
            self.log("Not mapping to isolates")

    def save_mapped_reads(self):
        mapped_read_ids = set(self.intermediate["to_viruses"].reads())

        handles = list()

        for file_path in self.calculate_read_path().split(","):
            if file_path.endswith("gz"):
                handle = gzip.open(file_path, "rt")
            else:
                handle = open(file_path, "r")

            handles.append(handle)

        with open(os.path.join(self.paths["analysis"], "mapped.fastq"), "w") as mapped_file:
            for handle in handles:
                for rec in SeqIO.parse(handle, "fastq"):
                    if rec.id in mapped_read_ids:
                        SeqIO.write(rec, mapped_file, "fastq")
                        mapped_read_ids.remove(rec.id)

    def map_host(self):
        self.log("Mapping to hosts")

        command = [
            "snap",
            "single",
            self.paths["host"],
            self.paths["analysis"] + "/mapped.fastq",
            "-t", str(self.proc - 1),
            # Aligned output only
            "-F", "a",
            "-o", "-sam", "-"
        ]

        to_host = virtool.pathoscope.sam.Lines(snap=True)

        self.run_process(command, no_output_failure=True, stdout_handler=to_host.add)

        self.intermediate["to_host"] = to_host

    def subtract_virus_mapping(self):
        subtraction_count = virtool.pathoscope.subtract.run(
            self.intermediate["to_viruses"],
            self.intermediate["to_host"]
        )

        del self.intermediate["to_host"]

        self.log(str(subtraction_count) + " reads eliminated as host reads")

    def cleanup(self):
        # Remove changes to sample entry in database that occurred during the failed analysis process
        self.collection_operation("samples", "_remove_analysis", {
            "_id": self.sample_id,
            "analysis_id": self.analysis_id
        })


class NuVs(Analyze):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.intermediate = dict()
        self.results = dict()

        self.stage_list += [
            self.mk_analysis_dir,
            self.map_viruses,
            self.map_host,
            self.assemble,
            self.process_fasta,
            self.vfam,
            self.import_results
        ]

    def mk_analysis_dir(self):
        """ Make a directory for RSEM files within the sample directory """
        os.mkdir(self.paths["analysis"])
        self.log("Made analysis directory")

    def map_viruses(self):
        """ Returns a list that defines a Bowtie2 command to map the sample reads against the virus index """
        files = self.calculate_read_path()

        command = [
            "bowtie2",
            "-p", str(self.proc),
            "-k", str(1),
            "--very-fast-local",
            "-x", self.paths["viruses"],
            "--un", self.paths["analysis"] + "/unmapped_viruses.fq",
            "-U", files
        ]

        self.run_process(command, no_output_failure=True)

    def map_host(self):
        self.log("Mapping to hosts")

        command = [
            "bowtie2",
            "--very-fast-local",
            "-k", str(1),
            "-p", str(self.proc),
            "-x", self.paths["host"],
            "--un", self.paths["analysis"] + "/unmapped_hosts.fq",
            "-U", self.paths["analysis"] + "/unmapped_viruses.fq"
        ]

        self.run_process(command, no_output_failure=True)

    def assemble(self):
        command = [
            "spades.py",
            "-t", str(self.proc - 1),
            "-m", str(self.mem),
            "-s", os.path.join(self.paths["analysis"], "unmapped_hosts.fq"),
            "-o", os.path.join(self.paths["analysis"], "spades"),
            "-k", "21,33,55,75"
        ]

        self.run_process(command)

    def process_fasta(self):
        self.results["sequences"] = list()
        self.results["orfs"] = list()

        index = 0

        for record in SeqIO.parse(os.path.join(self.paths["analysis"], "spades", "contigs.fasta"), "fasta"):

            seq_len = len(record.seq)

            orf_count = 0

            if seq_len > 300:
                for strand, nuc in [(+1, record.seq), (-1, record.seq.reverse_complement())]:
                    for frame in range(3):
                        trans = str(nuc[frame:].translate(1))
                        trans_len = len(trans)
                        aa_start = 0

                        while aa_start < trans_len:
                            aa_end = trans.find("*", aa_start)

                            if aa_end == -1:
                                aa_end = trans_len
                            if aa_end - aa_start >= 100:
                                if strand == 1:
                                    start = frame + aa_start * 3
                                    end = min(seq_len, frame + aa_end * 3 + 3)
                                else:
                                    start = seq_len - frame - aa_end * 3 - 3
                                    end = seq_len - frame - aa_start * 3

                                self.results["orfs"].append({
                                    "index": index,
                                    "orf_index": orf_count,
                                    "pro": str(trans[aa_start:aa_end]),
                                    "nuc": str(nuc[start:end]),
                                    "frame": frame,
                                    "strand": strand,
                                    "pos": (start, end)
                                })

                                orf_count += 1

                            aa_start = aa_end + 1

            if orf_count > 0:
                self.results["sequences"].append(str(record.seq))
                index += 1

        with open(os.path.join(self.paths["analysis"], "candidates.fa"), "w") as candidates:
            for entry in self.results["orfs"]:
                candidates.write(">sequence_{}.{}\n{}\n".format(
                    str(entry["index"]),
                    str(entry["orf_index"]),
                    entry["pro"]
                ))

    def vfam(self):
        self.results["hmm"] = []

        hmm_path = os.path.join(self.paths["analysis"], "hmm.tsv")

        command = [
            "hmmscan",
            "--tblout", hmm_path,
            "--noali",
            "--cpu", str(self.proc - 1),
            os.path.join(self.paths["data"], "hmm/vFam.hmm"),
            os.path.join(self.paths["analysis"], "candidates.fa")
        ]

        self.run_process(command)

        annotations = virtool.vfam.Annotations(os.path.join(self.paths["data"], "hmm/annotations"))
        annotations.guess_definitions()

        hit_path = os.path.join(self.paths["analysis"], "hits.tsv")

        header = [
            "index",
            "orf_index",
            "hit",
            "definition",
            "families",
            "full_e",
            "full_score",
            "full_bias",
            "best_e",
            "best_bias",
            "best_score"
        ]

        with open(hmm_path, "r") as hmm_file:
            with open(hit_path, "w") as hit_file:
                hit_file.write(",".join(header))

                for line in hmm_file:
                    if line.startswith("vFam"):
                        line = line.split()

                        annotation_id = int(line[0].split("_")[1])
                        annotation = annotations.find(annotation_id)

                        compound_id = line[2].split("_")[1].split(".")

                        entry = {
                            "index": int(compound_id[0]),
                            "orf_index": int(compound_id[1]),
                            "hit": line[0],
                            "definition": annotation["definition"],
                            "families": annotation["families"],
                            "full_e": float(line[4]),
                            "full_score": float(line[5]),
                            "full_bias": float(line[6]),
                            "best_e": float(line[7]),
                            "best_bias": float(line[8]),
                            "best_score": float(line[9])
                        }

                        self.results["hmm"].append(entry)

                        joined = ",".join([('"' + str(entry[key]) + '"') for key in header])

                        hit_file.write(joined + "\n")

    def import_results(self):
        referenced = [entry["index"] for entry in self.results["hmm"]]

        self.results["sequences"] = [
            {"sequence": seq, "index": i} for i, seq in enumerate(self.results["sequences"]) if i in referenced
        ]

        retained = [entry["index"] for entry in self.results["sequences"]]

        self.results["orfs"] = [orf for orf in self.results["orfs"] if orf["index"] in retained]

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
