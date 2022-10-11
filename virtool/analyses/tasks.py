import os
import shutil
from typing import Dict

from humanfriendly.testing import TemporaryDirectory
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.analyses.db import TARGET_FILES
from virtool.analyses.files import create_nuvs_analysis_files
from virtool.analyses.models import AnalysisFile
from virtool.analyses.utils import move_nuvs_files, join_analysis_path
from virtool.data.layer import DataLayer
from virtool.tasks.task import BaseTask
from virtool.utils import run_in_thread


class StoreNuvsFilesTask(BaseTask):
    name = "store_nuvs_files"

    def __init__(
        self, task_id: int, data: DataLayer, context: Dict, temp_dir: TemporaryDirectory
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.store_nuvs_files, self.remove_directory]

    async def store_nuvs_files(self):
        """
        Move existing NuVs analysis files to `<data_path>`/analyses/:id

        """
        db = self.db
        config = self.app["config"]

        async for analysis in db.analyses.find({"workflow": "nuvs"}):
            analysis_id = analysis["_id"]
            sample_id = analysis["sample"]["id"]

            path = join_analysis_path(config.data_path, analysis_id, sample_id)

            target_path = config.data_path / "analyses" / analysis_id

            async with AsyncSession(self.app["pg"]) as session:
                exists = (
                    await session.execute(
                        select(AnalysisFile).filter_by(analysis=analysis_id)
                    )
                ).scalar()

            if path.is_dir() and not exists:
                try:
                    await run_in_thread(os.makedirs, target_path)
                except FileExistsError:
                    pass

                analysis_files = []

                for filename in sorted(os.listdir(path)):
                    if filename in TARGET_FILES:
                        analysis_files.append(filename)

                        await move_nuvs_files(
                            filename, self.run_in_thread, path, target_path
                        )

                await create_nuvs_analysis_files(
                    self.app["pg"], analysis_id, analysis_files, target_path
                )

    async def remove_directory(self):
        """
        Remove `<data_path>`/samples/:id/analysis/:id directory
        after files have been preserved in
        `<data_path>`/analyses/:id>.

        """
        config = self.app["config"]

        async for analysis in self.db.analyses.find({"workflow": "nuvs"}):
            analysis_id = analysis["_id"]
            sample_id = analysis["sample"]["id"]

            path = join_analysis_path(config.data_path, analysis_id, sample_id)

            if (config.data_path / "analyses" / analysis_id).is_dir():
                await run_in_thread(shutil.rmtree, path, True)
