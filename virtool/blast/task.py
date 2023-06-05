import asyncio
from logging import getLogger
from tempfile import TemporaryDirectory
from typing import Optional, Dict, TYPE_CHECKING

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


logger = getLogger("blast")


BLAST_PARAMS = {
    "CMD": "Put",
    "DATABASE": "nr",
    "PROGRAM": "blastn",
    "MEGABLAST": "on",
    "HITLIST_SIZE": 5,
    "FILTER": "mL",
    "FORMAT_TYPE": "JSON2",
}
"""Parameters passed in BLAST request URL strings (eg. ?CMD=Put&DATABASE=nr)."""


class BLASTTask(BaseTask):

    """Runs a BLAST search against NCBI."""

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
        self.rid: Optional[str] = None

    async def request(self):
        """Make the initial request to NCBI to start a BLAST search."""
        blast = await self.data.blast.initialize_on_ncbi(
            self.analysis_id, self.sequence_index
        )

        self.rid = blast.rid

    async def wait(self, retries: int = 3):
        """
        Wait until the BLAST search completes.

        Keep check the BLAST status on NCBI with increasingly longer intervals between
        checks.

        Checks are conducted by the data layer and will store the results or error when
        the search completes. The task completes when either an error or

        The BLAST will be retried up to 3 times if a single BLAST search exceeds 10 minutes
        """

        async def wait_with_timeout():
            try:
                while True:
                    await asyncio.sleep(self.interval)

                    blast = await self.data.blast.check_nuvs_blast(
                        self.analysis_id, self.sequence_index
                    )

                    if blast.ready:
                        logger.info("Retrieved result for BLAST %s", blast.rid)
                        break

                    if blast.error:
                        logger.info(
                            "Encountered error for BLAST %s: %s",
                            blast.rid,
                            blast.error,
                        )
                        await self._set_error(blast.error)
                        break

                    self.interval += 5

                    logger.debug(
                        "Checked BLAST %s. Waiting %s seconds",
                        blast.rid,
                        self.interval,
                    )

            except asyncio.CancelledError:
                await self.data.blast.delete_nuvs_blast(
                    self.analysis_id, self.sequence_index
                )

                logger.info("Deleted BLAST due to cancellation: %s", self.rid)


        retries: int = 0

        while True:
            try:
                await asyncio.wait_for(wait_with_timeout(), 600)

            except asyncio.TimeoutError:
                if retries < 3:
                    retries += 1

                    continue

                else:
                    logger.error("BLAST timed out")
                    break
