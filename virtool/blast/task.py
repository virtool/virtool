import asyncio
from logging import getLogger
from tempfile import TemporaryDirectory
from typing import Optional, Dict, TYPE_CHECKING
from zipfile import BadZipFile

import virtool.blast.utils
import virtool.utils
from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.data.utils import get_data_from_app
from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


logger = getLogger("blast")

#: Parameters passed in BLAST request URL strings (eg. ?CMD=Put&DATABASE=nr).
BLAST_PARAMS = {
    "CMD": "Put",
    "DATABASE": "nr",
    "PROGRAM": "blastn",
    "MEGABLAST": "on",
    "HITLIST_SIZE": 5,
    "FILTER": "mL",
    "FORMAT_TYPE": "JSON2",
}


class BLASTTask(BaseTask):

    """Run a BLAST search against NCBI."""

    name = "blast"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.analysis_id = self.context["analysis_id"]
        self.sequence_index = self.context["sequence_index"]
        self.interval = 3
        self.steps = [self.request, self.wait]

    async def request(self):
        analysis = await self.data.analyses.get(self.analysis_id, None)

        sequence = find_nuvs_sequence_by_index(
            analysis.dict(by_alias=True), self.sequence_index
        )

        await self.data.blast.create_nuvs_blast(analysis.id, self.sequence_index)

    async def wait(self):
        try:
            while not self.ready:
                await self._sleep()

                self.ready = await virtool.blast.utils.check_rid(
                    self.app["config"], self.rid
                )

                logger.debug("Checked BLAST %s (%ss)", self.rid, self.interval)

                if self.ready:
                    try:
                        result_json = await virtool.blast.utils.get_ncbi_blast_result(
                            self.app["config"], self.app["run_in_process"], self.rid
                        )
                    except BadZipFile:
                        await self._update(
                            False, None, error="Unable to interpret NCBI result"
                        )
                        return

                    logger.info("Retrieved result for BLAST %s", self.rid)
                    result = virtool.blast.utils.format_blast_content(result_json)

                    return await self._update(True, result, None)

                await self._update(False, None, None)

        except asyncio.CancelledError:
            await get_data_from_app(self.app).blast.delete_nuvs_blast(
                self.analysis_id, self.sequence_index
            )

            logger.info("Removed BLAST due to cancellation: %s", self.rid)

    async def _sleep(self):
        """
        Sleep for the current interval and increase the interval by 5 seconds after
        sleeping.

        """
        await asyncio.sleep(self.interval)
        self.interval += 5
