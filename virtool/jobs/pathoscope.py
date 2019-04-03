"""
Functions and job classes for sample analysis.

"""
import json
import os
import shlex
import shutil

import pymongo
import pymongo.errors

import virtool.db.caches
import virtool.db.sync
import virtool.jobs.job
import virtool.jobs.utils
import virtool.otus
import virtool.pathoscope
import virtool.samples
import virtool.db.samples

TRIMMING_PROGRAM = "skewer-0.2.2"


class Job(virtool.jobs.job.Job):
    """
    A base class for all analysis job objects. Functions include:

    - establishing synchronous database connection
    - extracting task args to attributes
    - retrieving the sample and host documents
    - calculating the sample read count
    - constructing paths used by all subclasses

    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._stage_list = [
            self.make_analysis_dir,
            self.prepare_reads,
            self.prepare_qc,
            self.map_default_isolates,
            self.generate_isolate_fasta,
            self.build_isolate_index,
            self.map_isolates,
            self.map_subtraction,
            self.subtract_mapping,
            self.pathoscope,
            self.import_results,
            self.cleanup_indexes
        ]

    def check_db(self):
        """
        Get some initial information from the database that will be required during the course of the job.

        """
        self.params = {
            # The document id for the sample being analyzed. and the analysis document the results will be committed to.
            "sample_id": self.task_args["sample_id"],

            # The document id for the reference to analyze against.
            "ref_id": self.task_args["ref_id"],

            # The document id for the analysis being run.
            "analysis_id": self.task_args["analysis_id"]
        }

        # The parent folder for all data associated with the sample
        sample_path = os.path.join(self.settings["data_path"], "samples", self.params["sample_id"])

        self.params.update({
            # The path to the directory where all analysis result files will be written.
            "analysis_path": os.path.join(sample_path, "analysis", self.params["analysis_id"]),

            "index_path": os.path.join(
                self.settings["data_path"],
                "references",
                self.params["ref_id"],
                self.task_args["index_id"],
                "reference"
            )
        })

        # Get the complete sample document from the database.
        sample = self.db.samples.find_one(self.params["sample_id"])

        self.params.update({
            "paired": sample["paired"],
            #: The number of reads in the sample library. Assigned after database connection is made.
            "read_count": int(sample["quality"]["count"]),
            "srna": sample.get("srna", False),
            "subtraction_path": os.path.join(
                self.settings["data_path"],
                "subtractions",
                sample["subtraction"]["id"].lower().replace(" ", "_"),
                "reference"
            )
        })

        index_document = self.db.indexes.find_one(self.task_args["index_id"], ["manifest", "sequence_otu_map"])

        sequence_otu_map = index_document.get("sequence_otu_map", None)

        if sequence_otu_map is None:
            sequence_otu_map = get_sequence_otu_map(self.db, index_document["manifest"])

        self.params.update({
            "manifest": index_document["manifest"],
            "sequence_otu_map": sequence_otu_map
        })

    def make_analysis_dir(self):
        """
        Make a directory for the analysis in the sample/analysis directory.

        """
        os.mkdir(self.params["analysis_path"])

    def prepare_reads(self):
        """
        Fetch cache

        """
        self.intermediate["qc"] = None

        paired = self.params["paired"]
        srna = self.params["srna"]
        sample_id = self.params["sample_id"]

        parameters = virtool.jobs.utils.get_trimming_parameters(
            paired,
            self.params["srna"]
        )

        cache = virtool.jobs.utils.get_cache(
            self.db,
            sample_id,
            TRIMMING_PROGRAM,
            parameters
        )

        paths = None

        if cache:
            paths = virtool.jobs.utils.get_cache_read_paths(self.settings, cache)

            if paths:
                self.intermediate["qc"] = cache["quality"]
                self.params["read_paths"] = paths
                return

        if paths is None:
            sample = self.db.samples.find_one(sample_id)
            paths = virtool.jobs.utils.get_legacy_read_paths(self.settings, sample)

            if paths:
                self.intermediate["qc"] = sample["quality"]
                self.params["read_paths"] = paths
                return

        if paths is None:
            cache_id = virtool.db.caches.create(
                self.db,
                sample_id,
                parameters,
                paired
            )

            self.intermediate["cache_id"] = cache_id

            # The path for the nascent cache. Trimmed file will be written here.
            cache_path = virtool.jobs.utils.get_cache_path(self.settings, cache_id)

            os.makedirs(cache_path)

            # Paths for the trimmed read file(s).
            paths = virtool.jobs.utils.get_untrimmed_read_paths(
                self.settings,
                sample_id,
                paired
            )

            command = virtool.jobs.utils.get_trimming_command(
                cache_path,
                parameters,
                self.proc,
                paths
            )

            env = dict(os.environ, LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu")

            self.run_subprocess(command, env=env)

            virtool.jobs.utils.move_trimming_results(cache_path, paired)

        self.params["read_paths"] = paths

    def prepare_qc(self):
        if self.intermediate["qc"]:
            return

        cache_id = self.intermediate["cache_id"]

        cache_path = virtool.jobs.utils.get_cache_path(self.settings, cache_id)

        fastqc_path = os.path.join(cache_path, "fastqc")

        os.makedirs(fastqc_path)

        virtool.jobs.utils.run_fastqc(
            self.run_subprocess,
            self.proc,
            self.params["read_paths"],
            fastqc_path
        )

        qc = virtool.jobs.utils.parse_fastqc(fastqc_path, cache_path)

        self.intermediate["qc"] = qc

        self.db.caches.update_one({"_id": cache_id}, {
            "$set": {
                "quality": qc
            }
        })

        self.dispatch("caches", "update", [cache_id])

    def map_default_isolates(self):
        """
        Using ``bowtie2``, maps reads to the main otu reference. This mapping is used to identify candidate otus.

        """
        command = [
            "bowtie2",
            "-p", str(self.proc),
            "--no-unal",
            "--local",
            "--score-min", "L,20,1.0",
            "-N", "0",
            "-L", "15",
            "-x", self.params["index_path"],
            "-U", ",".join(self.params["read_paths"])
        ]

        to_otus = set()

        def stdout_handler(line):
            line = line.decode()

            if line[0] == "#" or line[0] == "@":
                return

            fields = line.split("\t")

            # Bitwise FLAG - 0x4: segment unmapped
            if int(fields[1]) & 0x4 == 4:
                return

            ref_id = fields[2]

            if ref_id == "*":
                return

            # Skip if the p_score does not meet the minimum cutoff.
            if virtool.pathoscope.find_sam_align_score(fields) < 0.01:
                return

            to_otus.add(ref_id)

        self.run_subprocess(command, stdout_handler=stdout_handler)

        self.intermediate["to_otus"] = to_otus

    def generate_isolate_fasta(self):
        """
        Identifies otu hits from the initial default otu mapping.

        """
        fasta_path = os.path.join(self.params["analysis_path"], "isolate_index.fa")

        ref_lengths = dict()

        sequence_otu_map = self.params["sequence_otu_map"]

        # The ids of OTUs whose default sequences had mappings.
        otu_ids = {sequence_otu_map[sequence_id] for sequence_id in self.intermediate["to_otus"]}

        # Get the database documents for the sequences
        with open(fasta_path, "w") as handle:
            # Iterate through each otu id referenced by the hit sequence ids.
            for otu_id in otu_ids:
                otu_version = self.params["manifest"][otu_id]
                _, patched, _ = virtool.db.sync.patch_otu_to_version(self.db, otu_id, otu_version)
                for isolate in patched["isolates"]:
                    for sequence in isolate["sequences"]:
                        handle.write(f">{sequence['_id']}\n{sequence['sequence']}\n")
                        ref_lengths[sequence["_id"]] = len(sequence["sequence"])

        del self.intermediate["to_otus"]

        self.intermediate["ref_lengths"] = ref_lengths

    def build_isolate_index(self):
        """
        Build an index with ``bowtie2-build`` from the FASTA file generated by
        :meth:`Pathoscope.generate_isolate_fasta`.

        """
        command = [
            "bowtie2-build",
            "--threads", str(self.proc),
            os.path.join(self.params["analysis_path"], "isolate_index.fa"),
            os.path.join(self.params["analysis_path"], "isolates")
        ]

        self.run_subprocess(command)

    def map_isolates(self):
        """
        Using ``bowtie2``, map the sample reads to the index built using :meth:`.build_isolate_index`.

        """
        command = [
            "bowtie2",
            "-p", str(self.proc - 1),
            "--no-unal",
            "--local",
            "--score-min", "L,20,1.0",
            "-N", "0",
            "-L", "15",
            "-k", "100",
            "--al", os.path.join(self.params["analysis_path"], "mapped.fastq"),
            "-x", os.path.join(self.params["analysis_path"], "isolates"),
            "-U", ",".join(self.params["read_paths"])
        ]

        with open(os.path.join(self.params["analysis_path"], "to_isolates.vta"), "w") as f:
            def stdout_handler(line, p_score_cutoff=0.01):
                line = line.decode()

                if line[0] == "@" or line == "#":
                    return

                fields = line.split("\t")

                # Bitwise FLAG - 0x4 : segment unmapped
                if int(fields[1]) & 0x4 == 4:
                    return

                ref_id = fields[2]

                if ref_id == "*":
                    return

                p_score = virtool.pathoscope.find_sam_align_score(fields)

                # Skip if the p_score does not meet the minimum cutoff.
                if p_score < p_score_cutoff:
                    return

                f.write(",".join([
                    fields[0],  # read_id
                    ref_id,
                    fields[3],  # pos
                    str(len(fields[9])),  # length
                    str(p_score)
                ]) + "\n")

            self.run_subprocess(command, stdout_handler=stdout_handler)

    def map_subtraction(self):
        """
        Using ``bowtie2``, map the reads that were successfully mapped in :meth:`.map_isolates` to the subtraction host
        for the sample.

        """
        command = [
            "bowtie2",
            "--local",
            "-N", "0",
            "-p", str(self.proc - 1),
            "-x", shlex.quote(self.params["subtraction_path"]),
            "-U", os.path.join(self.params["analysis_path"], "mapped.fastq")
        ]

        to_subtraction = dict()

        def stdout_handler(line):
            line = line.decode()

            if line[0] == "@" or line == "#":
                return

            fields = line.split("\t")

            # Bitwise FLAG - 0x4 : segment unmapped
            if int(fields[1]) & 0x4 == 4:
                return

            # No ref_id assigned.
            if fields[2] == "*":
                return

            to_subtraction[fields[0]] = virtool.pathoscope.find_sam_align_score(fields)

        self.run_subprocess(command, stdout_handler=stdout_handler)

        self.intermediate["to_subtraction"] = to_subtraction

    def subtract_mapping(self):
        subtracted_count = virtool.pathoscope.subtract(
            self.params["analysis_path"],
            self.intermediate["to_subtraction"]
        )

        del self.intermediate["to_subtraction"]

        self.results["subtracted_count"] = subtracted_count

    def pathoscope(self):
        """
        Run the Pathoscope reassignment algorithm. Tab-separated output is written to ``pathoscope.tsv``. Results are
        also parsed and saved to :attr:`intermediate`.

        """
        vta_path = os.path.join(self.params["analysis_path"], "to_isolates.vta")
        reassigned_path = os.path.join(self.params["analysis_path"], "reassigned.vta")

        (
            best_hit_initial_reads,
            best_hit_initial,
            level_1_initial,
            level_2_initial,
            best_hit_final_reads,
            best_hit_final,
            level_1_final,
            level_2_final,
            init_pi,
            pi,
            refs,
            reads
        ) = run_patho(vta_path, reassigned_path)

        read_count = len(reads)

        report = virtool.pathoscope.write_report(
            os.path.join(self.params["analysis_path"], "report.tsv"),
            pi,
            refs,
            read_count,
            init_pi,
            best_hit_initial,
            best_hit_initial_reads,
            best_hit_final,
            best_hit_final_reads,
            level_1_initial,
            level_2_initial,
            level_1_final,
            level_2_final
        )

        self.intermediate["coverage"] = virtool.pathoscope.calculate_coverage(
            reassigned_path,
            self.intermediate["ref_lengths"]
        )

        self.results.update({
            "ready": True,
            "read_count": read_count,
            "diagnosis": list()
        })

        for ref_id, hit in report.items():
            # Get the otu info for the sequence id.
            otu_id = self.params["sequence_otu_map"][ref_id]
            otu_version = self.params["manifest"][otu_id]

            hit["id"] = ref_id

            # Attach "otu" (id, version) to the hit.
            hit["otu"] = {
                "version": otu_version,
                "id": otu_id
            }

            # Get the coverage for the sequence.
            hit_coverage = self.intermediate["coverage"][ref_id]

            # Attach coverage list to hit dict.
            hit["align"] = hit_coverage

            # Calculate coverage and attach to hit.
            hit["coverage"] = round(1 - hit_coverage.count(0) / len(hit_coverage), 3)

            # Calculate depth and attach to hit.
            hit["depth"] = round(sum(hit_coverage) / len(hit_coverage))

            self.results["diagnosis"].append(hit)

    def import_results(self):
        """
        Commits the results to the database. Data includes the output of Pathoscope, final mapped read count,
        and viral genome coverage maps.

        Once the import is complete, :meth:`cleanup_index_files` is called to remove
        any otu indexes that may become unused when this analysis completes.

        """
        analysis_id = self.params["analysis_id"]
        sample_id = self.params["sample_id"]

        try:
            self.db.analyses.update_one({"_id": analysis_id}, {
                "$set": self.results
            })
        except pymongo.errors.DocumentTooLarge:
            with open(os.path.join(self.params["analysis_path"], "pathoscope.json"), "w") as f:
                json_string = json.dumps(self.results)
                f.write(json_string)

            self.db.analyses.update_one({"_id": analysis_id}, {
                "$set": {
                    "diagnosis": "file",
                    "ready": True
                }
            })

        virtool.db.sync.recalculate_algorithm_tags(self.db, sample_id)

        self.dispatch("analyses", "update", [analysis_id])
        self.dispatch("samples", "update", [sample_id])

    def cleanup(self):
        """
        Remove the analysis document and the analysis files. Dispatch the removal op. Recalculate and update the
        algorithm tags for the sample document.

        """
        cache_id = self.intermediate.get("cache_id")

        if cache_id:
            self.db.caches.delete_one({"_id": cache_id})
            cache_path = virtool.jobs.utils.get_cache_path(self.settings, cache_id)
            try:
                shutil.rmtree(cache_path)
            except FileNotFoundError:
                pass

        self.db.analyses.delete_one({"_id": self.params["analysis_id"]})

        try:
            shutil.rmtree(self.params["analysis_path"])
        except FileNotFoundError:
            pass

        sample_id = self.params["sample_id"]

        virtool.db.sync.recalculate_algorithm_tags(self.db, sample_id)

        self.dispatch("samples", "update", [sample_id])

    def cleanup_indexes(self):
        pass


def get_sequence_otu_map(db, manifest):
    sequence_otu_map = dict()

    for otu_id, otu_version in manifest.items():
        _, patched, _ = virtool.db.sync.patch_otu_to_version(
            db,
            otu_id,
            otu_version
        )

        for isolate in patched["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]
                sequence_otu_map[sequence_id] = patched["_id"]

    return sequence_otu_map


def run_patho(vta_path, reassigned_path):
    u, nu, refs, reads = virtool.pathoscope.build_matrix(vta_path)

    best_hit_initial_reads, best_hit_initial, level_1_initial, level_2_initial = virtool.pathoscope.compute_best_hit(
        u,
        nu,
        refs,
        reads
    )

    init_pi, pi, _, nu = virtool.pathoscope.em(u, nu, refs, 50, 1e-7, 0, 0)

    best_hit_final_reads, best_hit_final, level_1_final, level_2_final = virtool.pathoscope.compute_best_hit(
        u,
        nu,
        refs,
        reads
    )

    virtool.pathoscope.rewrite_align(u, nu, vta_path, 0.01, reassigned_path)

    return (
        best_hit_initial_reads,
        best_hit_initial,
        level_1_initial,
        level_2_initial,
        best_hit_final_reads,
        best_hit_final,
        level_1_final,
        level_2_final,
        init_pi,
        pi,
        refs,
        reads
    )
