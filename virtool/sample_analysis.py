import os
import shutil
from Bio import SeqIO

import virtool.app_settings
import virtool.blast
import virtool.job
import virtool.pathoscope.reassign
import virtool.pathoscope.subtract
import virtool.sam
import virtool.sample
import virtool.utils
import virtool.virus
import virtool.virus_history
import virtool.virus_hmm
import virtool.virus_index


LIST_PROJECTION = [
    "_id",
    "algorithm",
    "created_at",
    "ready",
    "job",
    "index",
    "user",
    "sample"
]


async def new(db, settings, manager, sample_id, user_id, algorithm):
    """
    Creates a new analysis. Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the requesting connection.

    """
    # Get the current id and version of the virus index currently being used for analysis.
    index_id, index_version = await virtool.virus_index.get_current_index(db)

    data = {
        "algorithm": algorithm,
        "sample": {
            "id": sample_id
        },
        "index": {
            "id": index_id,
            "version": index_version
        },
        "user": {
            "id": user_id,
        }
    }

    sample = await db.samples.find_one(sample_id, ["name"])

    analysis_id = await virtool.utils.get_new_id(db.analyses)

    job_id = await virtool.utils.get_new_id(db.jobs)

    document = dict(data)

    document.update({
        "_id": analysis_id,
        "ready": False,
        "created_at": virtool.utils.timestamp(),
        "job": {
            "id": job_id
        }
    })

    task_args = dict(
        data,
        analysis_id=analysis_id,
        sample_id=sample_id,
        sample_name=sample["name"],
        index_id=index_id
    )

    await db.analyses.insert_one(document)

    # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
    # _id. This dictionary will be passed the the new analysis job.
    await manager.new(
        data["algorithm"],
        task_args,
        settings.get("{}_proc".format(algorithm)),
        settings.get("{}_mem".format(algorithm)),
        user_id,
        job_id=job_id
    )

    await virtool.sample.recalculate_algorithm_tags(db, sample_id)

    return document


async def format_analysis(db, analysis):

    isolate_fields = [
        "default",
        "source_name",
        "source_type"
    ]

    sequence_fields = [
        "host",
        "definition"
    ]

    # Only included 'ready' analyses in the detail payload.
    if analysis["ready"] is True:
        if "pathoscope" in analysis["algorithm"]:
            # Holds viruses that have already been fetched from the database. If another isolate of a previously
            # fetched virus is found, there is no need for a round-trip back to the database.
            fetched_viruses = dict()

            found_isolates = list()

            annotated = dict()

            for accession, hit_document in analysis["diagnosis"].items():

                virus_id = hit_document["virus_id"]
                virus_version = hit_document["virus_version"]

                virus_document = fetched_viruses.get(virus_id, None)

                if virus_document is None:
                    # Get the virus entry (patched to correct version).
                    _, virus_document, _ = await virtool.virus_history.patch_virus_to_version(
                        db,
                        virus_id,
                        virus_version
                    )

                    fetched_viruses[virus_id] = virus_document

                    annotated[virus_id] = {
                        "_id": virus_id,
                        "name": virus_document["name"],
                        "abbreviation": virus_document["abbreviation"],
                        "isolates": dict(),
                        "ref_length": 0
                    }

                max_ref_length = 0

                for isolate in virus_document["isolates"]:

                    try:
                        isolate_id = isolate["id"]
                    except KeyError:
                        isolate_id = isolate["isolate_id"]

                    ref_length = 0

                    for sequence in isolate["sequences"]:
                        if sequence["_id"] == accession:
                            if isolate_id not in found_isolates:
                                reduced_isolate = {key: isolate[key] for key in isolate_fields}

                                reduced_isolate.update({
                                    "id": isolate_id,
                                    "hits": list()
                                })

                                annotated[virus_id]["isolates"][isolate_id] = reduced_isolate
                                found_isolates.append(isolate_id)

                            hit = dict(hit_document)
                            hit.update({key: sequence[key] for key in sequence_fields})
                            hit["accession"] = accession

                            annotated[virus_id]["isolates"][isolate_id]["hits"].append(hit)

                            ref_length += len(sequence["sequence"])

                    if ref_length > max_ref_length:
                        max_ref_length = ref_length

                annotated[virus_id]["ref_length"] = max_ref_length

            analysis["diagnosis"] = [annotated[virus_id] for virus_id in annotated]

        if analysis["algorithm"] == "nuvs":
            for hmm_result in analysis["hmm"]:
                hmm = await db.hmm.find_one({"_id": hmm_result["hit"]}, [
                    "cluster",
                    "families",
                    "definition",
                    "label"
                ])

                hmm_result.update(hmm)

        return analysis


class Base(virtool.job.Job):
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

        #: The document id for the sample being analyzed. and the analysis document the results will be committed to.
        self.sample_id = self.task_args["sample_id"]

        #: The document id for the analysis being run.
        self.analysis_id = self.task_args["analysis_id"]

        #: Stores intermediate data that is reused between job stages.
        self.intermediate = dict()

        #: Stores data that is processed and stored in the analysis document.
        self.results = dict()

        #: The document for the sample being analyzed. Assigned after database connection is made.
        self.sample = None

        #: The document for the host associated with the sample being analyzed. Assigned after database connection is
        # made.
        self.host = None

        #: The number of reads in the sample library. Assigned after database connection is made.
        self.read_count = None

        #: A dictionary of path strings that will be used to access files relevant to the analysis. Paths include:
        #: - data - test
        self.paths = dict()

        # The path to the general data directory
        self.paths["data"] = self.settings["data_path"]

        # The parent folder for all data associated with the sample
        self.paths["sample"] = os.path.join(self.paths["data"], "samples", "sample_{}".format(self.sample_id))

        # The path to the directory where all analysis result files will be written.
        self.paths["analysis"] = os.path.join(self.paths["sample"], "analysis", self.analysis_id)

        self._stage_list = [
            self.check_db,
            self.mk_analysis_dir
        ]

        self.sample = None

        self.read_paths = None

        #: The document for the host associated with the sample being analyzed. Assigned after job start.
        self.host = None

        #: The number of reads in the sample library. Assigned after job start.
        self.read_count = None

    @virtool.job.stage_method
    async def check_db(self):
        # Get the complete sample document from the database.
        self.sample = await self.db.samples.find_one({"_id": self.sample_id})

        # Extract the sample read count from the sample document.
        self.read_count = int(self.sample["quality"]["count"])

        # Calculate the path(s) to the sample read file(s).
        self.read_paths = [os.path.join(self.paths["sample"], "reads_1.fastq")]

        if self.sample["paired"]:
            self.read_paths.append(os.path.join(self.paths["sample"], "/reads_2.fastq"))

        if os.path.isfile(self.read_paths[0] + ".gz"):
            self.read_paths = [file_path + ".gz" for file_path in self.read_paths]

        # Get the complete host document from the database.
        self.host = await self.db.hosts.find_one({"_id": self.sample["subtraction"]})

    @virtool.job.stage_method
    def mk_analysis_dir(self):
        """
        Make a directory for the analysis within the sample analysis directory.

        """
        self.run_in_executor(os.mkdir, self.paths["analysis"])

    async def cleanup(self):
        """
        Remove the analysis document and the analysis files. Dispatch the removal op.

        Recalcaulate the algorithm tags for the sample document and dispatch the new processed document.

        """
        await self.db.analyses.delete_one({"_id": self.analysis_id})

        await self.dispatch("analyses", "remove", [self.analysis_id])

        try:
            await self.loop.run_in_executor(None, shutil.rmtree, self.paths["analysis"])
        except FileNotFoundError:
            pass

        document = await virtool.sample.recalculate_algorithm_tags(self.db, self.sample_id)

        await self.dispatch("samples", "update", document)


class Pathoscope(Base):

    """
    A base class for all Pathoscope-based tasks. Includes common functionality for:

    - identifying candidate viruses from initial mapping to default isolates
    - writing an multi-isolate FASTA for making an isolate index
    - running the Pathoscope algorithm
    - importing Pathoscope and other results to the database

    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @virtool.job.stage_method
    def identify_candidate_viruses(self):
        """
        Takes the initial default virus mapping from :attr:`.intermediate` and identifies all viruses hit by reads from
        the sample library. Determines if an isolate-level analysis should be performed because one or more of the
        candidates has more than one isolate.

        """
        # Get the accessions of the viral sequences that were hit.
        accessions = self.intermediate["to_viruses"].genomes()

        # Create a dict mapping isolate ids to the ids of their parent viruses
        aggregated = self.db.viruses.aggregate([
            {"$unwind": "$isolates"},
            {"$project": {
                "_id": "$isolates.isolate_id",
                "virus_id": "$_id"
            }}
        ])

        # Create a dict mapping isolate ids to virus ids. This will allow is to get from the hit accessions to
        # the ids of candidate viruses.
        isolate_to_virus = {entry["_id"]: entry["virus_id"] for entry in aggregated}

        # A dict of candidate viruses keyed by their document ids.
        viruses = dict()

        # Get the database documents for the sequences
        for sequence_entry in self.db.sequences.find({"_id": {"$in": accessions}}):
            # Get the virus and isolate ids associated with the sequence.
            isolate_id = sequence_entry["isolate_id"]
            virus_id = isolate_to_virus[isolate_id]

            # Get the document for the virus associated with the sequence unless it has already been retrieved.
            if virus_id not in viruses:
                virus = self.db.viruses.find_one({"_id": virus_id})

                for isolate in virus["isolates"]:
                    isolate_sequences = self.db.sequences.find({"isolate_id": isolate["isolate_id"]})
                    isolate["sequences"] = list(isolate_sequences)

                viruses[virus_id] = virus

        # Save the candidate virus documents for later use.
        self.intermediate["candidates"] = [virus for virus in viruses.values()]

    @virtool.job.stage_method
    def generate_isolate_fasta(self):
        """
        Writes a FASTA file containing the sequences for all isolates of the candidate viruses identified in
        :meth:`.identify_candidate_viruses`.

        """
        fasta_path = os.path.join(self.paths["analysis"], "isolate_index.fa")

        with open(fasta_path, "w") as fasta_file:
            for virus in self.intermediate["candidates"]:
                for isolate in virus["isolates"]:
                    for sequence in isolate["sequences"]:
                        fasta_file.write(">{}\n{}\n".format(sequence["_id"], sequence["sequence"]))

    @virtool.job.stage_method
    def pathoscope(self):
        """
        Run the Pathoscope reassignment algorithm. Tab-separated output is written to ``pathoscope.tsv``. Results are
        also parsed and saved to :attr:`intermediate`.

        """
        diagnosis, read_count, self.intermediate["reassigned"] = virtool.pathoscope.reassign.run(
            self.intermediate["to_viruses"],
            self.paths["analysis"] + "/pathoscope.tsv"
        )

        self.results["read_count"] = read_count

        cleaned = dict()

        for entry in diagnosis:
            genome_id = entry["genome"]
            final = entry["final"]

            sequence_entry = self.db.sequences.find_one({"_id": genome_id}, {"isolate_id": True})

            minimal_virus = self.db.viruses.find_one(
                {"isolates.isolate_id": sequence_entry["isolate_id"]},
                {"_id": True, "version": True}
            )

            cleaned[genome_id] = {key: final[key] for key in ["pi", "best", "reads"]}

            cleaned[genome_id].update({
                "virus_version": minimal_virus["version"],
                "virus_id": minimal_virus["_id"]
            })

        self.results["diagnosis"] = cleaned

    @virtool.job.stage_method
    async def import_results(self):
        """
        Commits the results to the database. Data includes the output of Pathoscope, final mapped read count,
        and viral genome coverage maps.

        Once the import is complete, :meth:`cleanup_index_files` is called to remove
        any virus indexes that may become unused when this analysis completes.

        """
        genome_ids = list(self.results["diagnosis"].keys())
        minimal_sequences = self.db.sequences.find({"_id": {"$in": genome_ids}})

        lengths = {entry["_id"]: len(entry["sequence"]) for entry in minimal_sequences}

        # Only calculate coverage if there are some diagnostic results.
        if self.results["diagnosis"]:
            coverage = virtool.sam.coverage(
                self.intermediate["reassigned"],
                lengths
            )

            # Attach the per-sequence coverage arrays to the diagnostic results.
            for ref_id in coverage:
                for key in coverage[ref_id]:
                    try:
                        self.results["diagnosis"][ref_id][key] = coverage[ref_id][key]
                    except KeyError:
                        pass

        document = await self.db.analyses.find_one({"_id": self.analysis_id})

        document.update(dict(self.results, ready=True))

        await self.db.analyses.update_one({"_id": self.analysis_id}, {
            "$set": document
        })

        document = await virtool.sample.recalculate_algorithm_tags(self.db, self.sample_id)

        await self.dispatch("samples", "update", document)

        self.call_static("cleanup_index_files")

    @virtool.job.stage_method
    def subtract_virus_mapping(self):
        """
        Subtracts virus and host alignments stored in :attr:`.intermediate` as :class:`virtool.pathoscope.sam.Lines`
        objects. Reads that have a higher alignment score to the host than to the virus reference are eliminated from
        the analysis.

        **Directly modifies the *to_viruses* :class:`.pathoscope.sam.Lines` object.**

        """
        virtool.pathoscope.subtract.run(
            self.intermediate["to_viruses"],
            self.intermediate["to_host"]
        )

        del self.intermediate["to_host"]


    @staticmethod
    async def cleanup_index_files(manager):
        await virtool.virus_index.cleanup_index_files(manager.db, manager.settings)


class PathoscopeBowtie(Pathoscope):

    """
    A Pathoscope analysis job that uses Bowtie2 to map reads to viral and host references. The ad-hoc isolate index
    is built using ``bowtie2-build``.

    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # The path the the Bowtie2 reference for all plant viruses
        self.paths["viruses"] = os.path.join(
            self.paths["data"],
            "reference/viruses",
            self._task_args["index_id"],
            "reference"
        )

        self._stage_list += [
            self.configure_paths,
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

    @virtool.job.stage_method
    def configure_paths(self):
        # The path to the index of the subtraction host for the sample.
        self.paths["host"] = os.path.join(
            self.paths["data"],
            "reference/hosts",
            self.sample["subtraction"].lower().replace(" ", "_"),
            "reference"
        )

    @virtool.job.stage_method
    async def map_viruses(self):
        """
        Using ``bowtie2``, maps reads to the main virus reference. This mapping is used to identify candidate viruses.

        """
        command = [
            "bowtie2",
            "-p", str(self.proc),
            "--local",
            "--score-min", "L,20,1.0",
            "-N", "0",
            "-L", "15",
            "-x", self.paths["viruses"],
            "--al", self.paths["analysis"] + "/mapped.fastq",
            "-U", ",".join(self.read_paths)
        ]

        to_viruses = virtool.sam.Lines()

        await self.run_subprocess(command)

        self.intermediate["to_viruses"] = to_viruses

    @virtool.job.stage_method
    async def build_isolate_index(self):
        """
        Build an index with ``bowtie2-build`` from the FASTA file generated by
        :meth:`Pathoscope.generate_isolate_fasta`.

        """
        command = [
            "bowtie2-build",
            self.paths["analysis"] + "/isolate_index.fa",
            self.paths["analysis"] + "/isolates"
        ]

        await self.run_subprocess(command)

    @virtool.job.stage_method
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
            "--al", os.path.join(self.paths["analysis"], "mapped.fastq"),
            "-x", os.path.join(self.paths["analysis"], "isolates"),
            "-U", ",".join(self.read_paths)
        ]

        self.intermediate["to_viruses"] = virtool.sam.Lines()

        handler = self.intermediate["to_viruses"].add

        self.run_subprocess(command)

    @virtool.job.stage_method
    def map_host(self):
        """
        Using ``bowtie2``, map the reads that were successfully mapped in :meth:`.map_isolates` to the subtraction host
        for the sample.

        """
        command = [
            "bowtie2",
            "--local",
            "-N", "0",
            "-p", str(self.proc - 1),
            "-x", self.paths["host"],
            "-U", os.path.join(self.paths["analysis"], "mapped.fastq")
        ]

        to_host = virtool.sam.Lines()

        self.run_subprocess(command)

        self.intermediate["to_host"] = to_host


class NuVs(Base):

    """
    A job class for NuVs, a custom workflow used for identifying potential viral sequences from sample libraries. The
    workflow consists of the following steps:

    1. Eliminate known viral reads by mapping the sample reads to the Virtool virus reference using ``bowtie2`` saving
       unaligned reads.
    2. Eliminate known host reads by mapping the reads remaining from the previous stage to the sample's subtraction
       host using ``bowtie2`` and saving the unaligned reads.
    3. Generate an assembly from the remaining reads using SPAdes.
    4. Extract all significant open reading frames (ORF) from the assembled contigs.
    5. Using HMMER/vFAM, identify possible viral domains in the ORFs.

    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.paths["viruses"] = os.path.join(
            self.paths["data"],
            "reference/viruses",
            self.task_args["index_id"],
            "reference"
        )

        self._stage_list += [
            self.configure_paths,
            self.map_viruses,
            self.map_host,
            self.reunite_pairs,
            self.assemble,
            self.process_fasta,
            self.press_hmm,
            self.vfam,
            self.import_results
        ]

    @virtool.job.stage_method
    def configure_paths(self):
        self.paths["host"] = os.path.join(
            self.paths["data"],
            "reference/hosts",
            self.sample["subtraction"].lower().replace(" ", "_"),
            "reference"
        )

    @virtool.job.stage_method
    def map_viruses(self):
        """
        Maps reads to the main virus reference using ``bowtie2``. Bowtie2 is set to use the search parameter
        ``--very-fast-local`` and retain unaligned reads to the FASTA file ``unmapped_viruses.fq``.

        """
        command = [
            "bowtie2",
            "-p", str(self._proc),
            "-k", str(1),
            "--very-fast-local",
            "-x", self.paths["viruses"],
            "--un", self.paths["analysis"] + "/unmapped_viruses.fq",
            "-U", ",".join(self.calculate_read_path())
        ]

        self.run_process(command, no_output_failure=True)

    @virtool.job.stage_method
    def map_host(self):
        """
        Maps unaligned reads from :meth:`.map_viruses` to the sample's subtraction host using ``bowtie2``. Bowtie2 is
        set to use the search parameter ``--very-fast-local`` and retain unaligned reads to the FASTA file
        ``unmapped_host.fq``.

        """
        command = [
            "bowtie2",
            "--very-fast-local",
            "-k", str(1),
            "-p", str(self._proc),
            "-x", self.paths["host"],
            "--un", self.paths["analysis"] + "/unmapped_hosts.fq",
            "-U", self.paths["analysis"] + "/unmapped_viruses.fq"
        ]

        self.run_process(command, no_output_failure=True)

    @virtool.job.stage_method
    def reunite_pairs(self):
        if self.sample["paired"]:
            with open(self.paths["analysis"] + "/unmapped_hosts.fq", "rU") as handle:
                unmapped_roots = {record.id.split(" ")[0] for record in SeqIO.parse(handle, "fastq")}

            files = self.calculate_read_path()

            with open(files[0], "r") as handle:
                s_dict = {record.id.split(" ")[0]: record for record in SeqIO.parse(handle, "fastq")}

                with open(self.paths["analysis"] + "/unmapped_1.fq", "w") as unmapped:
                    for root in unmapped_roots:
                        SeqIO.write(s_dict[root], unmapped, "fastq")

            with open(files[1], "r") as handle:
                s_dict = {record.id.split(" ")[0]: record for record in SeqIO.parse(handle, "fastq")}

                with open(self.paths["analysis"] + "/unmapped_2.fq", "w") as unmapped:
                    for root in unmapped_roots:
                        SeqIO.write(s_dict[root], unmapped, "fastq")

    @virtool.job.stage_method
    def assemble(self):
        """
        Call ``spades.py`` to assemble contigs from ``unmapped_hosts.fq``. Passes ``21,33,55,75`` for the ``-k``
        argument.

        """
        command = [
            "spades.py",
            "-t", str(self._proc - 1),
            "-m", str(self._mem)
        ]

        if self.sample["paired"]:
            command += [
                "-1", self.paths["analysis"] + "/unmapped_1.fq",
                "-2", self.paths["analysis"] + "/unmapped_2.fq",
            ]
        else:
            command += [
                "-s", os.path.join(self.paths["analysis"], "unmapped_hosts.fq"),
            ]

        command += [
            "-o", os.path.join(self.paths["analysis"], "spades"),
            "-k", "21,33,55,75"
        ]

        self.run_process(command)

    @virtool.job.stage_method
    def process_fasta(self):
        """
        Finds ORFs in the contigs assembled by :meth:`.assemble`. Only ORFs that are 100+ amino acids long are recorded.
        Contigs with no acceptable ORFs are discarded.

        """
        # Contigs that contain at least one acceptable ORF.
        self.results["sequences"] = list()

        # Acceptable ORFs found in assembled contigs.
        self.results["orfs"] = list()

        # A numeric index to identify the assembled contig. Increments by one for each FASTA entry.
        index = 0

        spades_path = os.path.join(self.paths["analysis"], "spades")

        fasta_path = os.path.join(spades_path, "scaffolds.fasta")

        for record in SeqIO.parse(fasta_path, "fasta"):

            seq_len = len(record.seq)

            orf_count = 0

            # Only look for ORFs if the contig is at least 300 nucleotides long.
            if seq_len > 300:
                # Looks at both forward (+) and reverse (-) strands.
                for strand, nuc in [(+1, record.seq), (-1, record.seq.reverse_complement())]:
                    # Look in all three translation frames.
                    for frame in range(3):
                        trans = str(nuc[frame:].translate(1))
                        trans_len = len(trans)
                        aa_start = 0

                        # Extract ORFs.
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

            # Save the contig sequence if it contains at least one acceptable ORF.
            if orf_count > 0:
                self.results["sequences"].append(str(record.seq))
                index += 1

        # Write the ORFs to a FASTA file so that they can be analyzed using HMMER and vFAM.
        with open(os.path.join(self.paths["analysis"], "candidates.fa"), "w") as candidates:
            for entry in self.results["orfs"]:
                candidates.write(">sequence_{}.{}\n{}\n".format(
                    str(entry["index"]),
                    str(entry["orf_index"]),
                    entry["pro"]
                ))

    @virtool.job.stage_method
    def press_hmm(self):

        shutil.copy(os.path.join(self.paths["data"], "hmm", "profiles.hmm"), self.paths["analysis"])

        hmm_path = os.path.join(self.paths["analysis"], "profiles.hmm")

        command = [
            "hmmpress",
            hmm_path
        ]

        self.run_process(command)

        os.remove(hmm_path)

    @virtool.job.stage_method
    def vfam(self):
        """
        Searches for viral motifs in ORF translations generated by :meth:`.process_fasta`. Calls ``hmmscan`` and
        searches against ``candidates.fa`` using the profile HMMs in ``data_path/hmm/vFam.hmm``.

        Saves two files:

        - ``hmm.tsv`` contains the raw output of `hmmer`
        - ``hits.tsv`` contains the `hmmer` results formatted and annotated with the annotations from the Virtool HMM
          database collection

        """
        self.results["hmm"] = list()

        # The path to output the hmmer results to.
        tsv_path = os.path.join(self.paths["analysis"], "hmm.tsv")

        command = [
            "hmmscan",
            "--tblout", tsv_path,
            "--noali",
            "--cpu", str(self._proc - 1),
            os.path.join(self.paths["analysis"], "profiles.hmm"),
            os.path.join(self.paths["analysis"], "candidates.fa")
        ]

        self.run_process(command)

        # The column titles for the ``hits.tsv`` output file.
        header = [
            "index",
            "orf_index",
            "hit",
            "full_e",
            "full_score",
            "full_bias",
            "best_e",
            "best_bias",
            "best_score"
        ]

        # The path to write ``hits.tsv`` to.
        hit_path = os.path.join(self.paths["analysis"], "hits.tsv")

        # Go through the raw HMMER results and annotate the HMM hits with data from the database.
        with open(tsv_path, "r") as hmm_file:
            with open(hit_path, "w") as hit_file:
                hit_file.write(",".join(header))

                for line in hmm_file:
                    if line.startswith("vFam"):
                        line = line.split()

                        cluster_id = int(line[0].split("_")[1])
                        annotation_id = self.db.hmm.find_one({"cluster": int(cluster_id)}, {"_id": True})["_id"]

                        compound_id = line[2].split("_")[1].split(".")

                        entry = {
                            "index": int(compound_id[0]),
                            "orf_index": int(compound_id[1]),
                            "hit": annotation_id,
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

    @virtool.job.stage_method
    def import_results(self):
        """
        Import into the analysis document in the database the following data:

        - the sequences with significant ORFs in them
        - all significant ORF sequences and metadata
        - the annotated HMMER results from ``hits.tsv``

        After the import is complete, :meth:`.indexes.Collection.cleanup_index_files` is called to remove any virus
        indexes that are no longer being used by an active analysis job.

        """
        referenced = [entry["index"] for entry in self.results["hmm"]]

        self.results["sequences"] = [
            {"sequence": seq, "index": i} for i, seq in enumerate(self.results["sequences"]) if i in referenced
        ]

        retained = [entry["index"] for entry in self.results["sequences"]]

        self.results["orfs"] = [orf for orf in self.results["orfs"] if orf["index"] in retained]

        self.call_static("set_analysis", self.sample_id, self.analysis_id, self.results)

        self.call_static("cleanup_index_files")

    @staticmethod
    async def set_analysis(manager, sample_id, analysis_id, data):
        """
        Update the analysis document identified using ``data``, which contains the analysis id and the update. Sets the
        analysis' ``ready`` field to ``True``. Sets the parent sample's ``analyzed`` field to ``True`` and increments
        its version by one.

        """
        db = manager.db

        document = await db.analyses.find_one({"_id": analysis_id})
        document.update(dict(data, ready=True))

        await db.analyses.update_one({"_id": analysis_id}, {
            "$set": document
        })

        await db.samples.update_one({"_id": sample_id}, {
            "$set": {"nuvs": True}
        })

    @staticmethod
    async def cleanup_index_files(manager):
        await virtool.virus_index.cleanup_index_files(manager.db, manager.settings)
