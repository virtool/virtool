
import json
import os
import pathlib
import re

import aiofiles

import virtool.analyses.utils
import virtool.api.utils
import virtool.db.core
import virtool.db.migrate

RE_JSON_FILENAME = re.compile("(pathoscope.json|nuvs.json)$")


async def migrate_analyses(app):
    """
    Delete unready analyses. Rename the `diagnosis` field in Pathoscope documents to `results`.

    This maintains consistency with NuVs documents and simplifies code reuse for processing analysis documents with
     different workflows.

    :param app: the application object

    """
    db = app["db"]
    settings = app["settings"]

    await rename_algorithm_field(db)
    await rename_results_field(db)
    await convert_pathoscope_files(db, settings)
    await rename_analysis_json_files(settings)
    await add_subtractions_to_analyses(db)
    await virtool.db.migrate.delete_unready(db.analyses)


async def add_subtractions_to_analyses(db):
    """
    Add subtraction fields to analysis documents based on the subtraction of their parent samples.

    :param db:
    :return:
    """
    # Return early if all analyses have subtraction fields.
    if await db.analyses.count_documents({"subtraction": {"$exists": False}}) == 0:
        return

    pipeline = [
        {
            "$match": {
                "subtraction": {
                    "$exists": True
                }
            }
        },
        {
            "$group": {
                "_id": "$subtraction.id",
                "id_list": {
                    "$addToSet": "$_id"
                }
            }
        }
    ]

    async for item in db.samples.aggregate(pipeline):
        sample_ids = item["id_list"]

        await db.analyses.update_many({"sample.id": {"$in": sample_ids}}, {
            "$set": {
                "subtraction.id": item["_id"]
            }
        })

    return True


async def convert_pathoscope_file(db, analysis_id, sample_id, data_path):
    path = os.path.join(
        virtool.analyses.utils.join_analysis_path(data_path, analysis_id, sample_id),
        "pathoscope.json"
    )

    async with aiofiles.open(path, "r") as f:
        data = json.loads(await f.read())

    async with aiofiles.open(path, "w") as f:
        await f.write(json.dumps(data["diagnosis"]))

    await db.analyses.update_one({"_id": analysis_id}, {
        "$set": {
            "ready": data["ready"],
            "read_count": data["read_count"]
        }
    })


async def convert_pathoscope_files(db, settings):
    """
    Rewrite the results JSON file to store only the results. Move the `ready` and `read_count` fields into the database.

    Only do this for pathoscope analyses. Documents with the `read_count` field is missing will be updated.

    :param db:
    :param settings:

    """
    query = {
        "workflow": "pathoscope_bowtie",
        "results": "file",
        "read_count": {
            "$exists": False
        }
    }

    async for document in db.analyses.find(query, ["_id", "sample"]):
        await convert_pathoscope_file(
            db,
            document["_id"],
            document["sample"]["id"],
            settings["data_path"]
        )


async def rename_algorithm_field(db):
    query = virtool.api.utils.compose_exists_query("algorithm")

    await db.analyses.update_many(query, {
        "$rename": {
            "algorithm": "workflow"
        }
    })


async def rename_analysis_json_files(settings: dict):
    """
    Rename all occurrences of `nuvs.json` and `pathoscope.json` to `results.json`.

    This will reduce overhead for future management and parsing of these files.

    :param settings: the application settings

    """
    path = pathlib.Path(settings["data_path"])

    for filepath in path.glob("samples/*/analysis/*/*.json"):
        filename = filepath.name

        if filename == "nuvs.json" or filename == "pathoscope.json":
            os.rename(
                str(filepath),
                os.path.join(filepath.parent, "results.json")
            )


async def rename_results_field(db):
    await db.analyses.update_many({"workflow": "pathoscope_bowtie"}, {
        "$rename": {
            "diagnosis": "results"
        }
    })
