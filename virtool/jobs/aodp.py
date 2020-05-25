import collections
import os
import pathlib
import shutil

import aiofiles
from Bio import SeqIO
from Bio.SeqRecord import SeqRecord

import virtool.jobs.analysis
import virtool.jobs.job
import virtool.samples.db
import virtool.utils

AODP_MAX_HOMOLOGY = 0
AODP_OLIGO_SIZE = 8


async def check_db(job):
    job.params["temp_index_path"] = os.path.join(job.temp_dir.name, "reference", "reference.fa")
    job.params["aodp_output_path"] = os.path.join(job.params["temp_analysis_path"], "aodp.out")

    job.params["index_path"] = os.path.join(
        job.settings["data_path"],
        "references",
        job.task_args["ref_id"],
        job.task_args["index_id"],
        "ref.fa"
    )


async def prepare_index(job):
    await job.run_in_executor(
        os.makedirs,
        pathlib.Path(job.params["temp_index_path"]).parent
    )

    await job.run_in_executor(
        shutil.copy,
        job.params["index_path"],
        job.params["temp_index_path"]
    )


async def join_reads(job):
    max_overlap = round(0.65 * job.params["sample_read_length"])

    command = [
        "flash",
        "--max-overlap", str(max_overlap),
        "-d", job.params["temp_analysis_path"],
        "-o", "flash",
        "-t", str(job.proc - 1),
        *job.params["read_paths"]
    ]

    await job.run_subprocess(command)

    joined_path = os.path.join(job.params["temp_analysis_path"], "flash.extendedFrags.fastq")
    remainder_path = os.path.join(job.params["temp_analysis_path"], "flash.notCombined_1.fastq")
    hist_path = os.path.join(job.params["temp_analysis_path"], "flash.hist")

    job.results = {
        "join_histogram": await parse_flash_histogram(hist_path),
        "joined_pair_count": await virtool.utils.file_length(joined_path) / 4,
        "remainder_pair_count": await virtool.utils.file_length(remainder_path) / 4
    }


async def deduplicate_reads(job):
    """
    Remove duplicate reads. Store the counts for unique reads.

    """
    joined_path = os.path.join(job.params["temp_analysis_path"], "flash.extendedFrags.fastq")
    output_path = os.path.join(job.params["temp_analysis_path"], "unique.fa")

    counts = await job.run_in_executor(
        run_dedup,
        joined_path,
        output_path
    )

    job.intermediate["sequence_counts"] = counts


async def aodp(job):
    cwd = job.params["temp_analysis_path"]

    aodp_output_path = job.params["aodp_output_path"]
    base_name = os.path.join(job.params["temp_analysis_path"], "aodp")
    target_path = os.path.join(job.params["temp_analysis_path"], "unique.fa")

    command = [
        "aodp",
        f"--basename={base_name}",
        f"--threads={job.proc}",
        f"--oligo-size={AODP_OLIGO_SIZE}",
        f"--match={target_path}",
        f"--match-output={aodp_output_path}",
        f"--max-homolo={AODP_MAX_HOMOLOGY}",
        job.params["temp_index_path"]
    ]

    await job.run_subprocess(command, cwd=cwd)

    parsed = list()

    async with aiofiles.open(job.params["aodp_output_path"], "r") as f:
        async for line in f:
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

            otu_id = job.params["sequence_otu_map"][sequence_id]
            otu_version = job.params["manifest"][otu_id]

            parsed.append({
                "id": read_id,
                "sequence_id": sequence_id,
                "identity": identity,
                "matched_length": int(split[3]),
                "read_length": int(split[4]),
                "min_cluster": int(split[5]),
                "max_cluster": int(split[6]),
                "count": job.intermediate["sequence_counts"][read_id],
                "otu": {
                    "version": otu_version,
                    "id": otu_id
                }
            })

    job.results["results"] = parsed


async def import_results(job):
    analysis_id = job.params["analysis_id"]
    sample_id = job.params["sample_id"]

    # Update the database document with the small data.
    await job.db.analyses.update_one({"_id": analysis_id}, {
        "$set": {
            **job.results,
            "ready": True
        }
    })

    await virtool.samples.db.recalculate_workflow_tags(job.db, sample_id)


def parse_joined_fastq(path: str, counts: collections.defaultdict):
    sequence_id_map = dict()

    for record in SeqIO.parse(path, format="fastq"):
        try:
            sequence_id = sequence_id_map[str(record.seq)]
        except KeyError:
            sequence_id = f"read_{len(sequence_id_map) + 1}"
            sequence_id_map[str(record.seq)] = sequence_id

            yield SeqRecord(record.seq, id=sequence_id)

        counts[sequence_id] += 1


async def parse_flash_histogram(path):
    hist = list()

    async with aiofiles.open(path, "r") as f:
        async for line in f:
            hist.append([int(i) for i in line.rstrip().split()])

    return hist


def run_dedup(joined_path, output_path):
    counts = collections.defaultdict(int)

    with open(output_path, "w") as f:
        for record in parse_joined_fastq(joined_path, counts):
            SeqIO.write(record, f, format="fasta")

    return dict(counts)


aodp_job = virtool.jobs.job.Job()

aodp_job.on_startup = [
    virtool.jobs.analysis.check_db,
    check_db
]

aodp_job.steps = [
    virtool.jobs.analysis.make_analysis_dir,
    prepare_index,
    virtool.jobs.analysis.prepare_reads,
    join_reads,
    deduplicate_reads,
    aodp,
    import_results
]

aodp_job.on_cleanup = [
    virtool.jobs.analysis.delete_analysis,
    virtool.jobs.analysis.delete_cache
]
