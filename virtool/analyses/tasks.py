import os
import shutil

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.analyses.files
import virtool.analyses.utils
import virtool.tasks.pg
import virtool.tasks.task

from virtool.analyses.db import TARGET_FILES
from virtool.analyses.models import AnalysisFile
from virtool.types import App


class StoreNuvsFilesTask(virtool.tasks.task.Task):
    task_type = "store_nuvs_file_task"

    def __init__(self, app: App, task_id: int):
        super().__init__(app, task_id)

        self.steps = [
            self.store_nuvs_files,
            self.remove_directory
        ]

        self.nuvs_directory = []

    async def store_nuvs_files(self):
        """
        Move existing NuVs analysis files to `<data_path>`/analyses/:id

        """
        db = self.db
        settings = self.app["settings"]

        async for analysis in db.analyses.find({"workflow": "nuvs"}):
            analysis_id = analysis["_id"]
            sample_id = analysis["sample"]["id"]

            path = virtool.analyses.utils.join_analysis_path(
                settings["data_path"],
                analysis_id,
                sample_id
            )

            target_path = settings["data_path"] / "analyses" / analysis_id

            async with AsyncSession(self.app["pg"]) as session:
                exists = (
                    await session.execute(select(AnalysisFile).filter_by(analysis=analysis_id))
                ).scalar()

            if path.is_dir() and not exists:
                try:
                    await self.app["run_in_thread"](os.makedirs, target_path)
                except FileExistsError:
                    pass

                analysis_files = list()

                for filename in sorted(os.listdir(path)):
                    if filename in TARGET_FILES:
                        analysis_files.append(filename)

                        await virtool.analyses.utils.move_nuvs_files(
                            filename,
                            self.run_in_thread,
                            path,
                            target_path
                        )

                await virtool.analyses.files.create_nuvs_analysis_files(
                    self.app["pg"],
                    analysis_id,
                    analysis_files,
                    target_path
                )

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="store_nuvs_files"
        )

    async def remove_directory(self):
        """
        Remove `<data_path>`/samples/:id/analysis/:id directory after files have been preserved in
        `<data_path>`/analyses/:id>.

        """
        settings = self.app["settings"]

        async for analysis in self.db.analyses.find({"workflow": "nuvs"}):
            analysis_id = analysis["_id"]
            sample_id = analysis["sample"]["id"]

            path = virtool.analyses.utils.join_analysis_path(
                settings["data_path"],
                analysis_id,
                sample_id
            )

            if (settings["data_path"] / "analyses" / analysis_id).is_dir():
                await self.app["run_in_thread"](shutil.rmtree, path, True)

        await virtool.tasks.pg.update(
            self.pg,
            self.id,
            step="remove_directory"
        )