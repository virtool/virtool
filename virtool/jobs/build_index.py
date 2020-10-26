import asyncio.tasks
import json
import os
import shutil
import typing

import aiofiles

import virtool.api.json
import virtool.errors
import virtool.history.db
import virtool.history.utils
import virtool.indexes.db
import virtool.jobs.job
import virtool.otus.db
import virtool.otus.utils
import virtool.references.db
import virtool.utils


async def check_db(job):
    """
    Get job information from the database.

    """
    job.params = dict(job.task_args)

    job.params["reference_path"] = os.path.join(
        job.settings["data_path"],
        "references",
        job.params["ref_id"]
    )

    job.params["index_path"] = os.path.join(
        job.params["reference_path"],
        job.params["index_id"]
    )

    job.params["temp_index_path"] = os.path.join(
        job.temp_dir.name,
        job.params["index_id"]
    )

    document = await job.db.references.find_one(job.params["ref_id"], ["data_type"])

    job.params["data_type"] = document["data_type"]


async def mk_index_dir(job):
    """
    Make dir for the new index at ``<data_path>/references/<index_id>``.

    """
    await job.run_in_executor(
        os.makedirs,
        job.params["temp_index_path"]
    )


async def write_fasta(job):
    """
    Generates a FASTA file of all sequences in the reference database. The FASTA headers are
    the accession numbers.

    """
    patched_otus = await get_patched_otus(
        job.db,
        job.settings,
        job.params["manifest"]
    )

    sequence_otu_map = dict()

    sequences = get_sequences_from_patched_otus(
        patched_otus,
        job.params["data_type"],
        sequence_otu_map
    )

    fasta_path = os.path.join(job.params["temp_index_path"], "ref.fa")

    await write_sequences_to_file(fasta_path, sequences)

    index_id = job.params["index_id"]

    await job.db.indexes.update_one({"_id": index_id}, {
        "$set": {
            "sequence_otu_map": sequence_otu_map
        }
    })


async def bowtie_build(job):
    """
    Run a standard bowtie-build process using the previously generated FASTA reference.
    The root name for the new reference is 'reference'

    """
    if job.params["data_type"] != "barcode":
        command = [
            "bowtie2-build",
            "-f",
            "--threads", str(job.proc),
            os.path.join(job.params["temp_index_path"], "ref.fa"),
            os.path.join(job.params["temp_index_path"], "reference")
        ]

        await job.run_subprocess(command)


async def upload(job):
    """
    Replaces the old index with the newly generated one.

    """
    await job.run_in_executor(
        shutil.copytree,
        job.params["temp_index_path"],
        job.params["index_path"]
    )

    # Tell the client the index is ready to be used and to no longer show it as building.
    await job.db.indexes.find_one_and_update({"_id": job.params["index_id"]}, {
        "$set": {
            "ready": True
        }
    })

    # Find OTUs with changes.
    pipeline = [
        {"$project": {
            "reference": True,
            "version": True,
            "last_indexed_version": True,
            "comp": {"$cmp": ["$version", "$last_indexed_version"]}
        }},
        {"$match": {
            "reference.id": job.params["ref_id"],
            "comp": {"$ne": 0}
        }},
        {"$group": {
            "_id": "$version",
            "id_list": {
                "$addToSet": "$_id"
            }
        }}
    ]

    id_version_key = {agg["_id"]: agg["id_list"] async for agg in job.db.otus.aggregate(pipeline)}

    # For each version number
    for version, id_list in id_version_key.items():
        await job.db.otus.update_many({"_id": {"$in": id_list}}, {
            "$set": {
                "last_indexed_version": version
            }
        })


async def build_json(job):
    """
    Create a reference.json.gz file at ``<data_path>/references/<ref_id>/<index_id>``.

    """
    await job.db.indexes.find_one_and_update({"_id": job.params["index_id"]}, {
        "$set": {
            "has_json": False
        }
    })

    document = await job.db.references.find_one(job.params["ref_id"], ["data_type", "organism", "targets"])

    app_dict = {
        "db": job.db,
        "settings": job.settings
    }

    otu_list = await virtool.references.db.export(
        app_dict,
        job.params["ref_id"]
    )

    data = {
        "otus": otu_list,
        "data_type": document["data_type"],
        "organism": document["organism"]
    }

    try:
        data["targets"] = document["targets"]
    except KeyError:
        pass

    file_path = os.path.join(
        job.params["index_path"],
        "reference.json.gz")

    # Convert the list of OTUs to a JSON-formatted string.
    json_string = json.dumps(data, cls=virtool.api.json.CustomEncoder)

    # Compress the JSON string to a gzip file.
    await job.run_in_executor(virtool.utils.compress_json_with_gzip,
                              json_string,
                              file_path)

    await job.db.indexes.find_one_and_update({"_id": job.params["index_id"]}, {
        "$set": {
            "has_json": True
        }
    })


async def delete_index(job: virtool.jobs.job.Job):
    """
    Removes the nascent index document and directory.

    :param job: the job object

    """
    await job.db.indexes.delete_one({"_id": job.params["index_id"]})

    try:
        await job.run_in_executor(
            virtool.utils.rm,
            job.params["index_path"],
            True
        )
    except FileNotFoundError:
        pass


async def reset_history(job: virtool.jobs.job.Job):
    """
    Sets the index ID and version fields for all history items included in failed build to 'unbuilt'.

    """
    query = {
        "_id": {
            "$in": await job.db.history.distinct("_id", {"index.id": job.params["index_id"]})
        }
    }

    # Set all the otus included in the build to "unbuilt" again.
    await job.db.history.update_many(query, {
        "$set": {
            "index": {
                "id": "unbuilt",
                "version": "unbuilt"
            }
        }
    })


async def get_patched_otus(db, settings: dict, manifest: dict) -> typing.List[dict]:
    """
    Get joined OTUs patched to a specific version based on a manifest of OTU ids and versions.

    :param db: the job database client
    :param settings: the application settings
    :param manifest: the manifest

    """
    app_dict = {
        "db": db,
        "settings": settings
    }

    coros = list()

    for patch_id, patch_version in manifest.items():
        coros.append(virtool.history.db.patch_to_version(
            app_dict,
            patch_id,
            patch_version
        ))

    return [j[1] for j in await asyncio.tasks.gather(*coros)]


def get_sequences_from_patched_otus(
        otus: typing.Iterable[dict],
        data_type: str, sequence_otu_map: dict
) -> typing.Generator[dict, None, None]:
    """
    Return sequence documents based on an `Iterable` of joined OTU documents. Writes a map of sequence IDs to OTU IDs
    into the passed `sequence_otu_map`.

    If `data_type` is `barcode`, all sequences are returned. Otherwise, only sequences of default isolates are returned.

    :param otus: an Iterable of joined OTU documents
    :param data_type: the data type of the parent reference for the OTUs
    :param sequence_otu_map: a dict to populate with sequence-OTU map information
    :return: a generator that yields sequence documents

    """
    for otu in otus:
        otu_id = otu["_id"]

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]
                sequence_otu_map[sequence_id] = otu_id

        if data_type == "barcode":
            for sequence in virtool.otus.utils.extract_sequences(otu):
                yield sequence
        else:
            for sequence in virtool.otus.utils.extract_default_sequences(otu):
                yield sequence


async def write_sequences_to_file(path: str, sequences: typing.Iterable):
    """
    Write a FASTA file based on a given `Iterable` containing sequence documents.

    Headers will contain the `_id` field of the document and the sequence text is from the `sequence` field.

    :param path: the path to write the file to
    :param sequences: the sequences to write to file

    """
    async with aiofiles.open(path, "w") as f:
        for sequence in sequences:
            sequence_id = sequence["_id"]
            sequence_data = sequence["sequence"]

            line = f">{sequence_id}\n{sequence_data}\n"
            await f.write(line)


def create():
    job = virtool.jobs.job.Job()

    job.on_startup = [
        check_db
    ]

    job.steps = [
        mk_index_dir,
        write_fasta,
        bowtie_build,
        upload,
        build_json
    ]

    job.on_cleanup = [
        delete_index,
        reset_history
    ]

    return job
