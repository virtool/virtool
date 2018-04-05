"""
Functions and job classes for sample analysis.

"""
import aiofiles
import collections
import json
import os
import pymongo.errors
import shlex
import shutil
import tempfile

import virtool.app_settings
import virtool.bio
import virtool.job
import virtool.pathoscope
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

    sample = await db.samples.find_one(sample_id, ["name"])

    analysis_id = await virtool.utils.get_new_id(db.analyses)

    job_id = await virtool.utils.get_new_id(db.jobs)

    document = {
        "_id": analysis_id,
        "ready": False,
        "created_at": virtool.utils.timestamp(),
        "job": {
            "id": job_id
        },
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

    task_args = dict(
        analysis_id=analysis_id,
        sample_id=sample_id,
        sample_name=sample["name"],
        index_id=index_id
    )

    if "pathoscope" in algorithm:
        sequence_virus_map = dict()
        virus_dict = dict()

        async for sequence_document in db.sequences.find({}, ["virus_id", "isolate_id"]):
            virus_id = sequence_document["virus_id"]

            virus = virus_dict.get(virus_id, None)

            if virus is None:
                virus = await db.viruses.find_one(virus_id, ["last_indexed_version"])

                try:
                    last_index_version = virus["last_indexed_version"]

                    virus_dict[virus["_id"]] = {
                        "id": virus["_id"],
                        "version": last_index_version
                    }

                    sequence_virus_map[sequence_document["_id"]] = virus_id
                except KeyError:
                    virus_dict[virus["id"]] = False

            sequence_virus_map[sequence_document["_id"]] = virus_id

        sequence_virus_map = [item for item in sequence_virus_map.items()]

        task_args.update({
            "virus_dict": virus_dict,
            "sequence_virus_map": sequence_virus_map
        })

    await db.analyses.insert_one(document)

    # Clone the arguments passed from the client and amend the resulting dictionary with the analysis entry
    # _id. This dictionary will be passed the the new analysis job.
    await manager.new(
        document["algorithm"],
        task_args,
        user_id,
        job_id=job_id
    )

    await virtool.sample.recalculate_algorithm_tags(db, sample_id)

    return document


def coverage_to_coordinates(coverage_list):
    previous_depth = coverage_list[0]
    coordinates = {(0, previous_depth)}

    last = len(coverage_list) - 1

    for i, depth in enumerate(coverage_list):
        if depth != previous_depth or i == last:
            coordinates.add((i - 1, previous_depth))
            coordinates.add((i, depth))

            previous_depth = depth

    coordinates = sorted(list(coordinates), key=lambda x: x[0])

    return coordinates


def get_square_distance(p1, p2):
    """
    Get the square of the distance between two points.

    """
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]

    return dx * dx + dy * dy


def get_square_segment_distance(p, p1, p2):
    """
    Get the square distance between a point and a segment.

    """
    x, y = p1

    dx = p2[0] - x
    dy = p2[1] - y

    if dx != 0 or dy != 0:
        t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)

        if t > 1:
            x, y = p2
        elif t > 0:
            x += dx * t
            y += dy * t

    dx = p[0] - x
    dy = p[1] - y

    return dx * dx + dy * dy


def simplify_radial_distance(points, tolerance):
    prev_point = points[0]
    new_points = [prev_point]

    point = None

    for point in points:
        if get_square_distance(point, prev_point) > tolerance:
            new_points.append(point)
            prev_point = point

    if point is not None and prev_point != point:
        new_points.append(point)

    return new_points


def simplify_douglas_peucker(points, tolerance):
    length = len(points)
    markers = [0] * length

    first = 0
    last = length - 1

    first_stack = list()
    last_stack = list()

    new_points = list()

    markers[first] = 1
    markers[last] = 1

    while last:
        max_squared_distance = 0

        for i in range(first, last):
            squared_distance = get_square_segment_distance(points[i], points[first], points[last])

            if squared_distance > max_squared_distance:
                index = i
                max_squared_distance = squared_distance

        if max_squared_distance > tolerance:
            markers[index] = 1

            first_stack.append(first)
            last_stack.append(index)

            first_stack.append(index)
            last_stack.append(last)

        # Can pop an empty array in Javascript, but not Python, so check
        # the length of the list first
        try:
            first = first_stack.pop()
        except IndexError:
            first = None

        try:
            last = last_stack.pop()
        except IndexError:
            last = None

    for i, point in enumerate(points):
        if markers[i]:
            new_points.append(point)

    return new_points


def smooth_coverage_coordinates(coordinates, tolerance=0.01):
    squared_tolerance = pow(tolerance, 2)

    return simplify_douglas_peucker(simplify_radial_distance(coordinates, squared_tolerance), squared_tolerance)


async def format_analysis(db, analysis):
    if "pathoscope" in analysis["algorithm"]:
        formatted = dict()

        for hit in analysis["diagnosis"]:

            virus_id = hit["virus"]["id"]
            version = hit["virus"]["version"]

            virus = formatted.get(virus_id, None)

            if virus is None:
                # Get the virus entry (patched to correct version).
                _, virus_document, _ = await virtool.virus_history.patch_virus_to_version(
                    db,
                    virus_id,
                    version
                )

                max_ref_length = 0

                for isolate in virus_document["isolates"]:
                    max_ref_length = max(max_ref_length, max([len(s["sequence"]) for s in isolate["sequences"]]))

                virus = {
                    "id": virus_id,
                    "name": virus_document["name"],
                    "version": virus_document["version"],
                    "abbreviation": virus_document["abbreviation"],
                    "isolates": virus_document["isolates"],
                    "length": max_ref_length
                }

                formatted[virus_id] = virus

            for isolate in virus["isolates"]:
                for sequence in isolate["sequences"]:
                    if sequence["_id"] == hit["id"]:
                        sequence.update(hit)
                        sequence["length"] = len(sequence["sequence"])

                        del sequence["virus"]
                        del sequence["virus_id"]
                        del sequence["isolate_id"]

        analysis["diagnosis"] = [formatted[virus_id] for virus_id in formatted]

        for virus in analysis["diagnosis"]:
            for isolate in list(virus["isolates"]):
                if not any((key in sequence for sequence in isolate["sequences"]) for key in ("pi", "final")):
                    virus["isolates"].remove(isolate)
                    continue

                for sequence in isolate["sequences"]:
                    if "final" in sequence:
                        sequence.update(sequence.pop("final"))
                        del sequence["initial"]
                    if "pi" not in sequence:
                        sequence.update({
                            "pi": 0,
                            "reads": 0,
                            "coverage": 0,
                            "best": 0,
                            "length": len(sequence["sequence"])
                        })

                    sequence["id"] = sequence.pop("_id")

                    if "align" in sequence:
                        coordinates = coverage_to_coordinates(sequence["align"])
                        sequence["align"] = smooth_coverage_coordinates(coordinates, tolerance=0.05)

                    del sequence["sequence"]

        return analysis

    if analysis["algorithm"] == "nuvs":
        for sequence in analysis["results"]:
            for orf in sequence["orfs"]:
                for hit in orf["hits"]:
                    hmm = await db.hmm.find_one({"_id": hit["hit"]}, [
                        "cluster",
                        "families",
                        "names"
                    ])

                    hit.update(hmm)

        return analysis

    raise ValueError("No algorithm field in document")


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

        #: Stores data that is processed and stored in the analysis document.
        self.results = dict()

        #: Intermediate data dict.
        self.intermediate = dict()

        #: The document for the sample being analyzed. Assigned after database connection is made.
        self.sample = None

        #: The document for the host associated with the sample being analyzed. Assigned after database connection is
        # made.
        self.subtraction = None

        #: The number of reads in the sample library. Assigned after database connection is made.
        self.read_count = None

        # The path to the general data directory
        self.data_path = self.settings.get("data_path")

        # The parent folder for all data associated with the sample
        self.sample_path = os.path.join(self.data_path, "samples", self.sample_id)

        # The path to the directory where all analysis result files will be written.
        self.analysis_path = os.path.join(self.sample_path, "analysis", self.analysis_id)

        self.index_path = os.path.join(
            self.data_path,
            "reference",
            "viruses",
            self.task_args["index_id"],
            "reference"
        )

        self.subtraction_path = None

        self._stage_list = [
            self.check_db,
            self.mk_analysis_dir
        ]

        self.sample = None

        self.paired = None

        self.read_paths = None

        #: The document for the host associated with the sample being analyzed. Assigned after job start.
        self.subtraction = None

        #: The number of reads in the sample library. Assigned after job start.
        self.read_count = None

    @virtool.job.stage_method
    async def check_db(self):
        """
        Get some initial information from the database that will be required during the course of the job.

        """
        # Get the complete sample document from the database.
        self.sample = await self.db.samples.find_one({"_id": self.sample_id})

        # Extract the sample read count from the sample document.
        self.read_count = int(self.sample["quality"]["count"])

        # Calculate the path(s) to the sample read file(s).
        self.read_paths = [os.path.join(self.sample_path, "reads_1.fastq")]

        self.paired = self.sample.get("paired", None)

        if self.paired is None:
            self.paired = len(self.sample["files"]) == 2

        if self.paired:
            self.read_paths.append(os.path.join(self.sample_path, "reads_2.fastq"))

        # Get the complete host document from the database.
        self.subtraction = await self.db.subtraction.find_one({"_id": self.sample["subtraction"]["id"]})

        self.subtraction_path = os.path.join(
            self.data_path,
            "reference",
            "subtraction",
            self.sample["subtraction"]["id"].lower().replace(" ", "_"),
            "reference"
        )

    @virtool.job.stage_method
    async def mk_analysis_dir(self):
        """
        Make a directory for the analysis in the sample/analysis directory.

        """
        await self.run_in_executor(os.mkdir, self.analysis_path)

    async def cleanup(self):
        """
        Remove the analysis document and the analysis files. Dispatch the removal op.

        Recalculate the algorithm tags for the sample document and dispatch the new processed document.

        """
        await self.db.analyses.delete_one({"_id": self.analysis_id})

        await self.dispatch("analyses", "remove", [self.analysis_id])

        try:
            await self.loop.run_in_executor(None, shutil.rmtree, self.analysis_path)
        except FileNotFoundError:
            pass

        document = await virtool.sample.recalculate_algorithm_tags(self.db, self.sample_id)

        await self.dispatch("samples", "update", document)


class Pathoscope(Base):

    """
    A base class for all Pathoscope-based tasks. Subclass of :class:`.sample_analysis.Base`.

    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.sequence_virus_map = {item[0]: item[1] for item in self.task_args["sequence_virus_map"]}

        self.virus_dict = self.task_args["virus_dict"]

    @virtool.job.stage_method
    async def generate_isolate_fasta(self):
        """
        Identifies virus hits from the initial default virus mapping.

        """
        fasta_path = os.path.join(self.analysis_path, "isolate_index.fa")

        sequence_ids = list(self.intermediate["to_viruses"])

        ref_lengths = dict()

        # Get the database documents for the sequences
        async with aiofiles.open(fasta_path, "w") as handle:
            # Iterate through each virus id referenced by the hit sequence ids.
            for virus_id in await self.db.sequences.distinct("virus_id", {"_id": {"$in": sequence_ids}}):
                # Write all of the sequences for each virus to a FASTA file.
                async for document in self.db.sequences.find({"virus_id": virus_id}, ["sequence"]):
                    await handle.write(">{}\n{}\n".format(document["_id"], document["sequence"]))
                    ref_lengths[document["_id"]] = len(document["sequence"])

        del self.intermediate["to_viruses"]

        self.intermediate["ref_lengths"] = ref_lengths

    @virtool.job.stage_method
    async def subtract_mapping(self):
        subtracted_count = await self.run_in_executor(
            virtool.pathoscope.subtract,
            self.analysis_path,
            self.intermediate["to_subtraction"]
        )

        del self.intermediate["to_subtraction"]

        self.results["subtracted_count"] = subtracted_count

    @virtool.job.stage_method
    async def pathoscope(self):
        """
        Run the Pathoscope reassignment algorithm. Tab-separated output is written to ``pathoscope.tsv``. Results are
        also parsed and saved to :attr:`intermediate`.

        """
        vta_path = os.path.join(self.analysis_path, "to_isolates.vta")
        reassigned_path = os.path.join(self.analysis_path, "reassigned.vta")

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
        ) = await self.run_in_executor(run_patho, self.analysis_path, vta_path, reassigned_path)

        read_count = len(reads)

        report = await self.run_in_executor(
            virtool.pathoscope.write_report,
            os.path.join(self.analysis_path, "report.tsv"),
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

        self.intermediate["coverage"] = await self.run_in_executor(
            virtool.pathoscope.calculate_coverage,
            reassigned_path,
            self.intermediate["ref_lengths"]
        )

        self.results = {
            "ready": True,
            "read_count": read_count,
            "diagnosis": list()
        }

        for ref_id, hit in report.items():
            # Get the virus info for the sequence id.
            virus = self.virus_dict[self.sequence_virus_map[ref_id]]

            # Raise exception if virus is ``False`` (meaning the virus had no ``last_indexed_version`` field).
            if not virus:
                raise ValueError("Document has no last_indexed_version field.")

            hit["id"] = ref_id

            # Attach "virus" (id, version) to the hit.
            hit["virus"] = virus

            # Get the coverage for the sequence.
            hit_coverage = self.intermediate["coverage"][ref_id]

            # Attach coverage list to hit dict.
            hit["align"] = hit_coverage

            # Calculate coverage and attach to hit.
            hit["coverage"] = round(1 - hit_coverage.count(0) / len(hit_coverage), 3)

            # Calculate depth and attach to hit.
            hit["depth"] = round(sum(hit_coverage) / len(hit_coverage))

            self.results["diagnosis"].append(hit)

    @virtool.job.stage_method
    async def import_results(self):
        """
        Commits the results to the database. Data includes the output of Pathoscope, final mapped read count,
        and viral genome coverage maps.

        Once the import is complete, :meth:`cleanup_index_files` is called to remove
        any virus indexes that may become unused when this analysis completes.

        """
        await self.db.analyses.update_one({"_id": self.analysis_id}, {
            "$set": self.results
        })

        document = await virtool.sample.recalculate_algorithm_tags(self.db, self.sample_id)

        await self.dispatch("samples", "update", document)

    @virtool.job.stage_method
    async def cleanup_indexes(self):
        pass


class PathoscopeBowtie(Pathoscope):

    """
    A Pathoscope analysis job that uses Bowtie2 to map reads to viral and host references. The ad-hoc isolate index
    is built using ``bowtie2-build``.

    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._stage_list = [
            self.check_db,
            self.mk_analysis_dir,
            self.map_viruses,
            self.generate_isolate_fasta,
            self.build_isolate_index,
            self.map_isolates,
            self.map_subtraction,
            self.subtract_mapping,
            self.pathoscope,
            self.import_results,
            self.cleanup_indexes
        ]

    @virtool.job.stage_method
    async def map_viruses(self):
        """
        Using ``bowtie2``, maps reads to the main virus reference. This mapping is used to identify candidate viruses.

        """
        command = [
            "bowtie2",
            "-p", str(self.proc),
            "--no-unal",
            "--local",
            "--score-min", "L,20,1.0",
            "-N", "0",
            "-L", "15",
            "-x", self.index_path,
            "-U", ",".join(self.read_paths)
        ]

        to_viruses = set()

        async def stdout_handler(line):
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

            to_viruses.add(ref_id)

        await self.run_subprocess(command, stdout_handler=stdout_handler)

        self.intermediate["to_viruses"] = to_viruses

    @virtool.job.stage_method
    async def build_isolate_index(self):
        """
        Build an index with ``bowtie2-build`` from the FASTA file generated by
        :meth:`Pathoscope.generate_isolate_fasta`.

        """
        command = [
            "bowtie2-build",
            os.path.join(self.analysis_path, "isolate_index.fa"),
            os.path.join(self.analysis_path, "isolates")
        ]

        await self.run_subprocess(command)

    @virtool.job.stage_method
    async def map_isolates(self):
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
            "--al", os.path.join(self.analysis_path, "mapped.fastq"),
            "-x", os.path.join(self.analysis_path, "isolates"),
            "-U", ",".join(self.read_paths)
        ]

        out_handle = await aiofiles.open(os.path.join(self.analysis_path, "to_isolates.vta"), "w")

        async def stdout_handler(line, p_score_cutoff=0.01):
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

            await out_handle.write(",".join([
                fields[0],  # read_id
                ref_id,
                fields[3],  # pos
                str(len(fields[9])),  # length
                str(p_score)
            ]) + "\n")

        await self.run_subprocess(command, stdout_handler=stdout_handler)

        await out_handle.close()

    @virtool.job.stage_method
    async def map_subtraction(self):
        """
        Using ``bowtie2``, map the reads that were successfully mapped in :meth:`.map_isolates` to the subtraction host
        for the sample.

        """
        command = [
            "bowtie2",
            "--local",
            "-N", "0",
            "-p", str(self.proc - 1),
            "-x", shlex.quote(self.subtraction_path),
            "-U", os.path.join(self.analysis_path, "mapped.fastq")
        ]

        to_subtraction = dict()

        async def stdout_handler(line):
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

        await self.run_subprocess(command, stdout_handler=stdout_handler)

        self.intermediate["to_subtraction"] = to_subtraction


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

        self._stage_list += [
            self.map_viruses,
            self.map_subtraction,
            self.reunite_pairs,
            self.assemble,
            self.process_fasta,
            self.press_hmm,
            self.vfam,
            self.import_results
        ]

        self.temp_dir = None

    @virtool.job.stage_method
    async def map_viruses(self):
        """
        Maps reads to the main virus reference using ``bowtie2``. Bowtie2 is set to use the search parameter
        ``--very-fast-local`` and retain unaligned reads to the FASTA file ``unmapped_viruses.fq``.

        """
        command = [
            "bowtie2",
            "-p", str(self.proc),
            "-k", str(1),
            "--very-fast-local",
            "-x", self.index_path,
            "--un", os.path.join(self.analysis_path, "unmapped_viruses.fq"),
            "-U", ",".join(self.read_paths)
        ]

        await self.run_subprocess(command)

    @virtool.job.stage_method
    async def map_subtraction(self):
        """
        Maps unaligned reads from :meth:`.map_viruses` to the sample's subtraction host using ``bowtie2``. Bowtie2 is
        set to use the search parameter ``--very-fast-local`` and retain unaligned reads to the FASTA file
        ``unmapped_host.fq``.

        """
        command = [
            "bowtie2",
            "--very-fast-local",
            "-k", str(1),
            "-p", str(self.proc),
            "-x", shlex.quote(self.subtraction_path),
            "--un", os.path.join(self.analysis_path, "unmapped_hosts.fq"),
            "-U", os.path.join(self.analysis_path, "unmapped_viruses.fq"),
        ]

        await self.run_subprocess(command)

    @virtool.job.stage_method
    async def reunite_pairs(self):
        if self.paired:
            unmapped_path = os.path.join(self.analysis_path, "unmapped_hosts.fq")
            await self.run_in_executor(run_reunion, self.analysis_path, self.read_paths, unmapped_path)

    @virtool.job.stage_method
    async def assemble(self):
        """
        Call ``spades.py`` to assemble contigs from ``unmapped_hosts.fq``. Passes ``21,33,55,75`` for the ``-k``
        argument.

        """
        command = [
            "spades.py",
            "-t", str(self.proc - 1),
            "-m", str(self.mem)
        ]

        if self.paired:
            command += [
                "-1", os.path.join(self.analysis_path, "unmapped_1.fq"),
                "-2", os.path.join(self.analysis_path, "unmapped_2.fq"),
            ]
        else:
            command += [
                "-s", os.path.join(self.analysis_path, "unmapped_hosts.fq"),
            ]

        self.temp_dir = tempfile.TemporaryDirectory()

        temp_path = self.temp_dir.name

        command += [
            "-o", temp_path,
            "-k", "21,33,55,75"
        ]

        try:
            await self.run_subprocess(command)
        except virtool.job.SubprocessError:
            spades_log_path = os.path.join(temp_path, "spades.log")

            async with aiofiles.open(spades_log_path, "r") as f:
                if "Error in malloc(): out of memory" in await f.read():
                    raise virtool.job.SubprocessError("Out of memory")

            raise

        await self.run_in_executor(
            shutil.copyfile,
            os.path.join(temp_path, "scaffolds.fasta"),
            os.path.join(self.analysis_path, "assembly.fa")
        )

        self.temp_dir.cleanup()

    @virtool.job.stage_method
    async def process_fasta(self):
        """
        Finds ORFs in the contigs assembled by :meth:`.assemble`. Only ORFs that are 100+ amino acids long are recorded.
        Contigs with no acceptable ORFs are discarded.

        """
        # Contigs that contain at least one acceptable ORF.
        self.results = list()

        assembly_path = os.path.join(self.analysis_path, "assembly.fa")

        assembly = await self.run_in_executor(virtool.bio.read_fasta, assembly_path)

        for _, sequence in assembly:

            sequence_length = len(sequence)

            # Don't consider the sequence if it is shorter than 300 bp.
            if sequence_length < 300:
                continue

            orfs = virtool.bio.find_orfs(sequence)

            # Don't consider the sequence if it has no ORFs.
            if len(orfs) == 0:
                continue

            # Add an index field to each orf dict.
            orfs = [dict(o, index=i) for i, o in enumerate(orfs)]

            for orf in orfs:
                orf.pop("nuc")
                orf["hits"] = list()

            # Make an entry for the nucleotide sequence containing a unique integer index, the sequence itself, and
            # all ORFs in the sequence.
            self.results.append({
                "index": len(self.results),
                "sequence": sequence,
                "orfs": orfs
            })

        # Write the ORFs to a FASTA file so that they can be analyzed using HMMER and vFAM.
        async with aiofiles.open(os.path.join(self.analysis_path, "orfs.fa"), "w") as f:
            for entry in self.results:
                for orf in entry["orfs"]:
                    await f.write(">sequence_{}.{}\n{}\n".format(entry["index"], orf["index"], orf["pro"]))

    @virtool.job.stage_method
    async def press_hmm(self):

        shutil.copy(os.path.join(self.data_path, "hmm", "profiles.hmm"), self.analysis_path)

        hmm_path = os.path.join(self.analysis_path, "profiles.hmm")

        command = [
            "hmmpress",
            hmm_path
        ]

        await self.run_subprocess(command)

        os.remove(hmm_path)

    @virtool.job.stage_method
    async def vfam(self):
        """
        Searches for viral motifs in ORF translations generated by :meth:`.process_fasta`. Calls ``hmmscan`` and
        searches against ``candidates.fa`` using the profile HMMs in ``data_path/hmm/vFam.hmm``.

        Saves two files:

        - ``hmm.tsv`` contains the raw output of `hmmer`
        - ``hits.tsv`` contains the `hmmer` results formatted and annotated with the annotations from the Virtool HMM
          database collection

        """
        # The path to output the hmmer results to.
        tsv_path = os.path.join(self.analysis_path, "hmm.tsv")

        command = [
            "hmmscan",
            "--tblout", tsv_path,
            "--noali",
            "--cpu", str(self.proc - 1),
            os.path.join(self.analysis_path, "profiles.hmm"),
            os.path.join(self.analysis_path, "orfs.fa")
        ]

        await self.run_subprocess(command)

        hits = collections.defaultdict(lambda: collections.defaultdict(list))

        # Go through the raw HMMER results and annotate the HMM hits with data from the database.
        async with aiofiles.open(tsv_path, "r") as hmm_file:
            async for line in hmm_file:
                if line.startswith("vFam"):
                    line = line.split()

                    cluster_id = int(line[0].split("_")[1])
                    annotation_id = (await self.db.hmm.find_one({"cluster": int(cluster_id)}, {"_id": True}))["_id"]

                    # Expecting sequence_0.0
                    sequence_index, orf_index = (int(x) for x in line[2].split("_")[1].split("."))

                    hits[sequence_index][orf_index].append({
                        "hit": annotation_id,
                        "full_e": float(line[4]),
                        "full_score": float(line[5]),
                        "full_bias": float(line[6]),
                        "best_e": float(line[7]),
                        "best_bias": float(line[8]),
                        "best_score": float(line[9])
                    })

        for sequence_index in hits:
            for orf_index in hits[sequence_index]:
                self.results[sequence_index]["orfs"][orf_index]["hits"] = hits[sequence_index][orf_index]

            sequence = self.results[sequence_index]

            if all(len(o["hits"]) == 0 for o in sequence["orfs"]):
                self.results.remove(sequence)

    @virtool.job.stage_method
    async def import_results(self):
        """
        Save the results to the analysis document and set the ``ready`` field to ``True``.

        After the import is complete, :meth:`.indexes.Collection.cleanup_index_files` is called to remove any virus
        indexes that are no longer being used by an active analysis job.

        """
        try:
            await self.db.analyses.find_one_and_update({"_id": self.analysis_id}, {
                "$set": {
                    "results": self.results,
                    "ready": True
                }
            })
        except pymongo.errors.DocumentTooLarge:
            async with aiofiles.open(os.path.join(self.analysis_path, "nuvs.json"), "w") as f:
                json_string = json.dumps(self.results)
                await f.write(json_string)

            await self.db.analyses.find_one_and_update({"_id": self.analysis_id}, {
                "$set": {
                    "results": "file",
                    "ready": True
                }
            })

        document = await virtool.sample.recalculate_algorithm_tags(self.db, self.sample_id)

        await self.dispatch("samples", "update", document)

    async def cleanup(self):
        try:
            self.temp_dir.cleanup()
        except AttributeError:
            pass

        await super().cleanup()


def run_patho(analysis_path, vta_path, reassigned_path):

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


def run_reunion(analysis_path, read_paths, unmapped_path):

    headers = virtool.bio.read_fastq_headers(unmapped_path)

    unmapped_roots = {h.split(" ")[0] for h in headers}

    with open(os.path.join(analysis_path, "unmapped_1.fq"), "w") as f:
        for header, seq, quality in virtool.bio.read_fastq(read_paths[0]):
            if header.split(" ")[0] in unmapped_roots:
                f.write("\n".join([header, seq, "+", quality]) + "\n")

    with open(os.path.join(analysis_path, "unmapped_2.fq"), "w") as f:
        for header, seq, quality in virtool.bio.read_fastq(read_paths[1]):
            if header.split(" ")[0] in unmapped_roots:
                f.write("\n".join([header, seq, "+", quality]) + "\n")
