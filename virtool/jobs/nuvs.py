"""
Job class and functions for NuVs.

"""
import collections
import os
import shlex
import shutil

import aiofiles

import virtool.bio
import virtool.jobs.analysis
import virtool.jobs.job
import virtool.samples.db


class SubprocessError(Exception):
    pass


async def eliminate_otus(job):
    """
    Maps reads to the main otu reference using ``bowtie2``. Bowtie2 is set to use the search parameter
    ``--very-fast-local`` and retain unaligned reads to the FASTA file ``unmapped_otus.fq``.

    """
    command = [
        "bowtie2",
        "-p", str(job.proc),
        "-k", str(1),
        "--very-fast-local",
        "-x", job.params["index_path"],
        "--un", os.path.join(job.params["temp_analysis_path"], "unmapped_otus.fq"),
        "-U", ",".join(job.params["read_paths"])
    ]

    await job.run_subprocess(command)


async def eliminate_subtraction(job):
    """
    Maps unaligned reads from :meth:`.map_otus` to the sample's subtraction host using ``bowtie2``. Bowtie2 is
    set to use the search parameter ``--very-fast-local`` and retain unaligned reads to the FASTA file
    ``unmapped_host.fq``.

    """
    command = [
        "bowtie2",
        "--very-fast-local",
        "-k", str(1),
        "-p", str(job.proc),
        "-x", shlex.quote(job.params["subtraction_path"]),
        "--un", os.path.join(job.params["temp_analysis_path"], "unmapped_hosts.fq"),
        "-U", os.path.join(job.params["temp_analysis_path"], "unmapped_otus.fq"),
    ]

    await job.run_subprocess(command)


async def reunite_pairs(job):
    if job.params["paired"]:
        unmapped_path = os.path.join(job.params["temp_analysis_path"], "unmapped_hosts.fq")
        headers = await virtool.bio.read_fastq_headers(unmapped_path)

        unmapped_roots = {h.split(" ")[0] for h in headers}

        left_path = os.path.join(job.params["temp_analysis_path"], "unmapped_1.fq")
        right_path = os.path.join(job.params["temp_analysis_path"], "unmapped_2.fq")

        async with aiofiles.open(left_path, "w") as f:
            async for header, seq, quality in virtool.bio.read_fastq_from_path(job.params["read_paths"][0]):
                if header.split(" ")[0] in unmapped_roots:
                    await f.write("\n".join([header, seq, "+", quality]) + "\n")

        async with aiofiles.open(right_path, "w") as f:
            async for header, seq, quality in virtool.bio.read_fastq_from_path(job.params["read_paths"][1]):
                if header.split(" ")[0] in unmapped_roots:
                    await f.write("\n".join([header, seq, "+", quality]) + "\n")


async def assemble(job):
    """
    Call ``spades.py`` to assemble contigs from ``unmapped_hosts.fq``. Passes ``21,33,55,75`` for the ``-k``
    argument.

    """
    command = [
        "spades.py",
        "-t", str(job.proc - 1),
        "-m", str(job.mem)
    ]

    if job.params["paired"]:
        command += [
            "-1", os.path.join(job.params["temp_analysis_path"], "unmapped_1.fq"),
            "-2", os.path.join(job.params["temp_analysis_path"], "unmapped_2.fq"),
        ]
    else:
        command += [
            "-s", os.path.join(job.params["temp_analysis_path"], "unmapped_hosts.fq"),
        ]

    temp_path = job.temp_dir.name

    k = "21,33,55,75"

    if job.params["library_type"] == "srna":
        k = "17,21,23"

    command += [
        "-o", temp_path,
        "-k", k
    ]

    try:
        await job.run_subprocess(command)
    except SubprocessError:
        spades_log_path = os.path.join(temp_path, "spades.log")

        if os.path.isfile(spades_log_path):
            async with aiofiles.open(spades_log_path, "r") as f:
                if "Error in malloc(): out of memory" in await f.read():
                    raise SubprocessError("Out of memory")

        raise

    await job.run_in_executor(
        shutil.copyfile,
        os.path.join(temp_path, "scaffolds.fasta"),
        os.path.join(job.params["temp_analysis_path"], "assembly.fa")
    )


async def process_fasta(job):
    """
    Finds ORFs in the contigs assembled by :meth:`.assemble`. Only ORFs that are 100+ amino acids long are recorded.
    Contigs with no acceptable ORFs are discarded.

    """
    assembly_path = os.path.join(job.params["temp_analysis_path"], "assembly.fa")

    assembly = await job.run_in_executor(
        virtool.bio.read_fasta,
        assembly_path
    )

    sequences = list()

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
        sequences.append({
            "index": len(sequences),
            "sequence": sequence,
            "orfs": orfs
        })

    # Write the ORFs to a FASTA file so that they can be analyzed using HMMER and vFAM.
    orfs_path = os.path.join(job.params["temp_analysis_path"], "orfs.fa")

    async with aiofiles.open(orfs_path, "w") as f:
        for entry in sequences:
            for orf in entry["orfs"]:
                await f.write(f">sequence_{entry['index']}.{orf['index']}\n{orf['pro']}\n")

    job.results["sequences"] = sequences


async def prepare_hmm(job):
    await job.run_in_executor(
        shutil.copy,
        os.path.join(job.settings["data_path"], "hmm", "profiles.hmm"),
        job.params["temp_analysis_path"]
    )

    hmm_path = os.path.join(job.params["temp_analysis_path"], "profiles.hmm")

    command = [
        "hmmpress",
        hmm_path
    ]

    await job.run_subprocess(command)

    await job.run_in_executor(
        os.remove,
        hmm_path
    )


async def vfam(job):
    """
    Searches for viral motifs in ORF translations generated by :meth:`.process_fasta`. Calls ``hmmscan`` and
    searches against ``candidates.fa`` using the profile HMMs in ``data_path/hmm/vFam.hmm``.

    Saves two files:

    - ``hmm.tsv`` contains the raw output of `hmmer`
    - ``hits.tsv`` contains the `hmmer` results formatted and annotated with the annotations from the Virtool HMM
      database collection

    """
    # The path to output the hmmer results to.
    tsv_path = os.path.join(job.params["temp_analysis_path"], "hmm.tsv")

    command = [
        "hmmscan",
        "--tblout", tsv_path,
        "--noali",
        "--cpu", str(job.proc - 1),
        os.path.join(job.params["temp_analysis_path"], "profiles.hmm"),
        os.path.join(job.params["temp_analysis_path"], "orfs.fa")
    ]

    await job.run_subprocess(command)

    hits = collections.defaultdict(lambda: collections.defaultdict(list))

    # Go through the raw HMMER results and annotate the HMM hits with data from the database.
    async with aiofiles.open(tsv_path, "r") as f:
        async for line in f:
            if line.startswith("vFam"):
                line = line.split()

                cluster_id = int(line[0].split("_")[1])
                annotation_id = (await job.db.hmm.find_one({"cluster": int(cluster_id)}, {"_id": True}))["_id"]

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

    sequences = job.results["sequences"]

    for sequence_index in hits:
        for orf_index in hits[sequence_index]:
            sequences[sequence_index]["orfs"][orf_index]["hits"] = hits[sequence_index][orf_index]

        sequence = sequences[sequence_index]

        if all(len(o["hits"]) == 0 for o in sequence["orfs"]):
            sequences.remove(sequence)


async def import_results(job):
    """
    Save the results to the analysis document and set the ``ready`` field to ``True``.

    After the import is complete, :meth:`.indexes.Collection.cleanup_index_files` is called to remove any otus
    indexes that are no longer being used by an active analysis job.

    """
    analysis_id = job.params["analysis_id"]
    sample_id = job.params["sample_id"]

    await virtool.jobs.analysis.set_analysis_results(
        job.db,
        analysis_id,
        job.params["analysis_path"],
        job.results["sequences"]
    )

    await virtool.samples.db.recalculate_workflow_tags(job.db, sample_id)


def create():
    job = virtool.jobs.job.Job()

    job.on_startup = [
        virtool.jobs.analysis.check_db
    ]

    job.steps = stage_list = [
        virtool.jobs.analysis.make_analysis_dir,
        virtool.jobs.analysis.prepare_reads,
        eliminate_otus,
        eliminate_subtraction,
        reunite_pairs,
        assemble,
        process_fasta,
        prepare_hmm,
        vfam,
        virtool.jobs.analysis.upload,
        import_results
    ]

    job.on_cleanup = [
        virtool.jobs.analysis.delete_analysis,
        virtool.jobs.analysis.delete_cache
    ]

    return job
