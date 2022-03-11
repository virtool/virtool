import json
import os
import shutil
from asyncio import gather
from datetime import timedelta
from pathlib import Path

import aiohttp
import arrow
from semver import VersionInfo

import virtool.otus.db
import virtool.tasks.pg
from virtool.errors import GitHubError
from virtool.github import create_update_subdocument
from virtool.history.db import patch_to_version
from virtool.history.utils import remove_diff_files
from virtool.http.utils import download_file
from virtool.references.db import (
    download_and_parse_release,
    fetch_and_update_release,
    insert_change,
    insert_joined_otu,
    update_joined_otu,
)
from virtool.references.utils import (
    check_import_data,
    load_reference_file,
)
from virtool.tasks.task import Task
from virtool.utils import get_temp_dir


class CloneReferenceTask(Task):
    task_type = "clone_reference"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [self.copy_otus, self.create_history]

    async def copy_otus(self):
        manifest = self.context["manifest"]
        created_at = self.context["created_at"]
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        tracker = await self.get_tracker(len(manifest))

        inserted_otu_ids = list()

        await virtool.tasks.pg.update(self.pg, self.id, step="copy_otus")

        for source_otu_id, version in manifest.items():
            _, patched, _ = await patch_to_version(self.app, source_otu_id, version)

            otu_id = await insert_joined_otu(
                self.db, patched, created_at, ref_id, user_id
            )

            inserted_otu_ids.append(otu_id)

            await tracker.add(1)

        await self.update_context({"inserted_otu_ids": inserted_otu_ids})

    async def create_history(self):
        user_id = self.context["user_id"]
        inserted_otu_ids = self.context["inserted_otu_ids"]

        tracker = await self.get_tracker(len(inserted_otu_ids))

        await virtool.tasks.pg.update(self.pg, self.id, step="create_history")

        for otu_id in inserted_otu_ids:
            await insert_change(self.app, otu_id, "clone", user_id)
            await tracker.add(1)

    async def cleanup(self):
        ref_id = self.context["ref_id"]

        query = {"reference.id": ref_id}

        diff_file_change_ids = await self.db.history.distinct(
            "_id", {**query, "diff": "file"}
        )

        await virtool.tasks.pg.update(self.pg, self.id, step="cleanup")

        await gather(
            self.db.references.delete_one({"_id": ref_id}),
            self.db.history.delete_many(query),
            self.db.otus.delete_many(query),
            self.db.sequences.delete_many(query),
            remove_diff_files(self.app, diff_file_change_ids),
        )


class ImportReferenceTask(Task):
    task_type = "import_reference"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.load_file,
            self.set_metadata,
            self.validate,
            self.import_otus,
            self.create_history,
        ]

        self.import_data = None

    async def load_file(self):
        path = self.context["path"]
        tracker = await self.get_tracker()
        try:
            self.import_data = await self.run_in_thread(load_reference_file, path)
        except json.decoder.JSONDecodeError as err:
            return await self.error(str(err).split("JSONDecodeError: ")[1])
        except OSError as err:
            if "Not a gzipped file" in str(err):
                return await self.error("Not a gzipped file")
            else:
                return await self.error(str(err))

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="load_file"
        )

    async def set_metadata(self):
        ref_id = self.context["ref_id"]
        tracker = await self.get_tracker()

        try:
            data_type = self.import_data["data_type"]
        except (TypeError, KeyError):
            data_type = "genome"

        try:
            organism = self.import_data["organism"]
        except (TypeError, KeyError):
            organism = ""

        try:
            targets = self.import_data["targets"]
        except (TypeError, KeyError):
            targets = None

        update_dict = {"data_type": data_type, "organism": organism}

        if targets:
            update_dict["targets"] = targets

        await self.db.references.update_one({"_id": ref_id}, {"$set": update_dict})

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="set_metadata"
        )

    async def validate(self):
        tracker = await self.get_tracker()

        errors = check_import_data(self.import_data, strict=False, verify=True)

        if errors:
            return await self.error(errors)

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="validate"
        )

    async def import_otus(self):
        created_at = self.context["created_at"]
        ref_id = self.context["ref_id"]
        user_id = self.context["user_id"]

        otus = self.import_data["otus"]

        tracker = await self.get_tracker(len(otus))

        inserted_otu_ids = list()

        for otu in otus:
            otu_id = await insert_joined_otu(self.db, otu, created_at, ref_id, user_id)
            inserted_otu_ids.append(otu_id)
            await tracker.add(1)

        await self.update_context({"inserted_otu_ids": inserted_otu_ids})

        await virtool.tasks.pg.update(self.pg, self.id, step="import_otus")

    async def create_history(self):
        inserted_otu_ids = self.context["inserted_otu_ids"]
        user_id = self.context["user_id"]

        tracker = await self.get_tracker(len(inserted_otu_ids))

        for otu_id in inserted_otu_ids:
            await insert_change(self.app, otu_id, "import", user_id)

            await tracker.add(1)

        await virtool.tasks.pg.update(self.pg, self.id, step="create_history")


class RemoteReferenceTask(Task):
    task_type = "remote_reference"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [self.download, self.create_history, self.update_reference]

        self.import_data = None
        self.inserted_otu_ids = list()

    async def download(self):
        tracker = await self.get_tracker(self.context["release"]["size"])

        try:
            self.import_data = await download_and_parse_release(
                self.app, self.context["release"]["download_url"], self.id, tracker.add
            )
        except (aiohttp.ClientConnectorError, GitHubError):
            return await virtool.tasks.pg.update(
                self.pg, self.id, error="Could not download reference data"
            )

        try:
            data_type = self.import_data["data_type"]
        except KeyError:
            return await virtool.tasks.pg.update(
                self.pg, self.id, error="Could not infer data type"
            )

        await self.db.references.update_one(
            {"_id": self.context["ref_id"]},
            {
                "$set": {
                    "data_type": data_type,
                    "organism": self.import_data.get("organism", "Unknown"),
                }
            },
        )

        error = check_import_data(self.import_data, strict=True, verify=True)

        if error:
            return await virtool.tasks.pg.update(self.pg, self.id, error=error)

        await virtool.tasks.pg.update(self.pg, self.id, step="import")

    async def create_history(self):
        otus = self.import_data["otus"]

        tracker = await self.get_tracker(len(otus))

        for otu in otus:
            otu_id = await insert_joined_otu(
                self.db,
                otu,
                self.context["created_at"],
                self.context["ref_id"],
                self.context["user_id"],
                remote=True,
            )
            self.inserted_otu_ids.append(otu_id)
            await tracker.add(1)

        await virtool.tasks.pg.update(self.pg, self.id, step="create_history")

    async def update_reference(self):
        tracker = await self.get_tracker(len(self.import_data["otus"]))

        for otu_id in self.inserted_otu_ids:
            await insert_change(self.app, otu_id, "remote", self.context["user_id"])

            await tracker.add(1)

        await self.db.references.update_one(
            {
                "_id": self.context["ref_id"],
                "updates.id": self.context["release"]["id"],
            },
            {
                "$set": {
                    "installed": create_update_subdocument(
                        self.context["release"], True, self.context["user_id"]
                    ),
                    "updates.$.ready": True,
                    "updating": False,
                }
            },
        )

        await fetch_and_update_release(self.app, self.context["ref_id"])

        await virtool.tasks.pg.update(self.pg, self.id, step="Update_reference")


class DeleteReferenceTask(Task):
    task_type = "delete_reference"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [
            self.remove_directory,
            self.remove_indexes,
            self.remove_unreferenced_otus,
            self.remove_referenced_otus,
        ]

        self.non_existent_references = []

    async def remove_directory(self):
        tracker = await self.get_tracker()

        path = self.app["config"].data_path / "references"

        reference_ids = os.listdir(path)
        existent_references = await self.db.references.distinct(
            "_id", {"_id": {"$in": reference_ids}}
        )
        self.non_existent_references = [
            ref_id for ref_id in reference_ids if ref_id not in existent_references
        ]

        for dir_name in self.non_existent_references:
            await self.app["run_in_thread"](shutil.rmtree, path / dir_name, True)

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="remove_directory"
        )

    async def remove_indexes(self):
        tracker = await self.get_tracker()

        await self.db.indexes.delete_many(
            {"reference.id": {"$in": self.non_existent_references}}
        )

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="remove_indexes"
        )

    async def remove_unreferenced_otus(self):
        tracker = await self.get_tracker()

        for ref_id in self.non_existent_references:
            referenced_otu_ids = await self.db.analyses.distinct(
                "results.otu.id", {"reference.id": ref_id}
            )

            unreferenced_otu_ids = await self.db.otus.distinct(
                "_id",
                {"reference.id": ref_id, "_id": {"$not": {"$in": referenced_otu_ids}}},
            )

            diff_file_change_ids = await self.db.history.distinct(
                "_id", {"diff": "file", "otu.id": {"$in": unreferenced_otu_ids}}
            )

            await gather(
                self.db.otus.delete_many({"_id": {"$in": unreferenced_otu_ids}}),
                self.db.history.delete_many({"otu.id": {"$in": unreferenced_otu_ids}}),
                self.db.sequences.delete_many(
                    {"otu_id": {"$in": unreferenced_otu_ids}}
                ),
                remove_diff_files(self.app, diff_file_change_ids),
            )

            await virtool.tasks.pg.update(
                self.pg,
                self.id,
                progress=tracker.step_completed,
                step="remove_unreferenced_otus",
            )

    async def remove_referenced_otus(self):
        tracker = await self.get_tracker()

        user_id = self.context["user_id"]

        for ref_id in self.non_existent_references:
            async for document in self.db.otus.find({"reference.id": ref_id}):
                await virtool.otus.db.remove(
                    self.app, document["_id"], user_id, document=document, silent=True
                )

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            progress=tracker.step_completed,
            step="remove_referenced_otus",
        )


class UpdateRemoteReferenceTask(Task):
    task_type = "update_remote_reference"

    def __init__(self, *args):
        super().__init__(*args)

        self.steps = [
            self.download_and_extract,
            self.update_otus,
            self.create_history,
            self.remove_otus,
            self.update_reference,
        ]

    async def download_and_extract(self):
        url = self.context["release"]["download_url"]
        file_size = self.context["release"]["size"]

        tracker = await self.get_tracker(file_size)

        try:
            with get_temp_dir() as tempdir:
                download_path = Path(tempdir) / "reference.tar.gz"

                await download_file(self.app, url, download_path, tracker.add)

                self.intermediate["update_data"] = await self.run_in_thread(
                    load_reference_file, download_path
                )

        except (aiohttp.ClientConnectorError, GitHubError):
            return await self.error("Could not download reference data")

        await virtool.tasks.pg.update(self.pg, self.id, step="download_and_extract")

    async def update_otus(self):
        update_data = self.intermediate["update_data"]

        tracker = await self.get_tracker(len(update_data["otus"]))

        # The remote ids in the update otus.
        otu_ids_in_update = {otu["_id"] for otu in update_data["otus"]}

        updated_list = list()

        for otu in update_data["otus"]:
            old_or_id = await update_joined_otu(
                self.db,
                otu,
                self.context["created_at"],
                self.context["ref_id"],
                self.context["user_id"],
            )

            if old_or_id is not None:
                updated_list.append(old_or_id)

            await tracker.add(1)

        self.intermediate.update(
            {"otu_ids_in_update": otu_ids_in_update, "updated_list": updated_list}
        )

        await virtool.tasks.pg.update(self.pg, self.id, step="update_otus")

    async def create_history(self):
        updated_list = self.intermediate["updated_list"]

        tracker = await self.get_tracker(len(updated_list))

        for old_or_id in updated_list:
            try:
                otu_id = old_or_id["_id"]
                old = old_or_id
            except TypeError:
                otu_id = old_or_id
                old = None

            await insert_change(
                self.app,
                otu_id,
                "update" if old else "remote",
                self.context["user_id"],
                old,
            )

            await tracker.add(1)

        await virtool.tasks.pg.update(self.pg, self.id, step="create_history")

    async def remove_otus(self):
        # Delete OTUs with remote ids that were not in the update.
        to_delete = await self.db.otus.distinct(
            "_id",
            {
                "reference.id": self.context["ref_id"],
                "remote.id": {"$nin": list(self.intermediate["otu_ids_in_update"])},
            },
        )

        tracker = await self.get_tracker(len(to_delete))

        for otu_id in to_delete:
            await virtool.otus.db.remove(self.app, otu_id, self.context["user_id"])

            await tracker.add(1)

        await virtool.tasks.pg.update(self.pg, self.id, step="remove_otus")

    async def update_reference(self):
        tracker = await self.get_tracker()
        ref_id = self.context["ref_id"]
        release = self.context["release"]

        await self.db.references.update_one(
            {"_id": ref_id, "updates.id": release["id"]},
            {
                "$set": {
                    "installed": create_update_subdocument(
                        release, True, self.context["user_id"]
                    ),
                    "updates.$.ready": True,
                }
            },
        )

        await fetch_and_update_release(self.app, ref_id)

        await self.db.references.update_one(
            {"_id": ref_id}, {"$set": {"updating": False}}
        )

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=tracker.step_completed, step="update_reference"
        )


class CleanReferencesTask(Task):
    task_type = "clean_references"

    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [self.clean_timed_out_updates]

    async def _remove_latest_update(self, ref_id):
        await self.db.references.update_one(
            {"_id": ref_id}, {"$pop": {"updates": -1}, "$set": {"updating": False}}
        )

    async def clean_timed_out_updates(self):
        async for reference in self.db.references.find(
            {"remotes_from": {"$exists": True}}, ["installed", "task", "updates"]
        ):
            if len(reference["updates"]) == 0:
                continue

            latest_update = reference["updates"][-1]

            if latest_update["ready"]:
                continue

            installed_version = VersionInfo.parse(
                reference["installed"]["name"].lstrip("v")
            )

            latest_update_version = VersionInfo.parse(latest_update["name"].lstrip("v"))

            if latest_update_version <= installed_version:
                continue

            if arrow.utcnow() - arrow.get(latest_update["created_at"]) > timedelta(
                minutes=15
            ):
                await self._remove_latest_update(reference["_id"])
