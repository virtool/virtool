import asyncio
from logging import getLogger
from typing import Optional
from zipfile import BadZipFile

import virtool.blast.utils
import virtool.utils
from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.data.utils import get_data_from_app
from virtool.tasks.task import Task

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


class BLASTTask(Task):

    """Run a BLAST search against NCBI."""

    task_type = "blast"

    def __init__(self, app, task_id: str):
        super().__init__(app, task_id)

        self.analysis_id = None
        self.sequence_index = None

        self.error = None
        self.interval = 3
        self.ready = False
        self.result = None
        self.rid = None
        self.steps = [self.request, self.wait]

    async def init_db(self):
        await super().init_db()

        self.analysis_id = self.context["analysis_id"]
        self.sequence_index = self.context["sequence_index"]

    async def request(self):
        document = await get_data_from_app(self.app).analyses.get_by_id(
            self.analysis_id
        )

        sequence = find_nuvs_sequence_by_index(document, self.sequence_index)

        rid, _ = await virtool.blast.utils.initialize_ncbi_blast(
            self.app["config"], sequence
        )

        self.rid = rid

        await self._update(False, None, None)

    async def wait(self):
        try:
            while not self.ready:
                await self._sleep()

                self.ready = await virtool.blast.utils.check_rid(
                    self.app["config"], self.rid
                )

                logger.debug(f"Checked BLAST {self.rid} ({self.interval}s)")

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

                    logger.info(f"Retrieved result for BLAST {self.rid}")
                    result = virtool.blast.utils.format_blast_content(result_json)

                    return await self._update(True, result, None)

                await self._update(False, None, None)

        except asyncio.CancelledError:
            await get_data_from_app(self.app).blast.remove_nuvs_blast(
                self.analysis_id, self.sequence_index
            )

            logger.info(f"Removed BLAST due to cancellation: {self.rid}")

    async def _sleep(self):
        """
        Sleep for the current interval and increase the interval by 5 seconds after
        sleeping.

        """
        await asyncio.sleep(self.interval)
        self.interval += 5

    async def _update(self, ready: bool, result: Optional[dict], error: Optional[str]):
        """
        Update the BLAST data. Returns the BLAST data and the complete analysis
        document.

        :param ready: indicates whether the BLAST request is complete
        :param result: the formatted result of a successful BLAST request
        :param error: and error message to add to the BLAST record
        :return: the BLAST data and the complete analysis document

        """
        self.result = result

        if ready is None:
            self.ready = await virtool.blast.utils.check_rid(
                self.app["config"], self.rid
            )
        else:
            self.ready = ready

        await get_data_from_app(self.app).blast.update_nuvs_blast(
            self.analysis_id,
            self.sequence_index,
            self.error,
            virtool.utils.timestamp(),
            self.rid,
            self.ready,
            self.result,
        )
