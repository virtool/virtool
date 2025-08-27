import asyncio
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, Dict, Optional

from structlog import get_logger

from virtool.tasks.task import BaseTask

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


logger = get_logger("blast")


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
        self.steps = [self.request]
        self.rid: Optional[str] = None

    async def request(self) -> None:
        """Make the initial request to NCBI to start a BLAST search.

        Checks are conducted by the data layer and will store the results or error
        when the search completes. The task completes when either an error or

        The BLAST will be retried up to 3 times if a single BLAST
        search exceeds 10 minutes.
        """
        log = logger.bind(rid=self.rid)

        blast_timeout_count: int = 0

        while True:
            try:
                blast = await self.data.blast.initialize_on_ncbi(
                    self.analysis_id,
                    self.sequence_index,
                )

                self.rid = blast.rid

                await asyncio.wait_for(self.wait_for_blast_search(), 600)

                break

            except asyncio.TimeoutError:
                await self.data.blast.delete_nuvs_blast(
                    self.analysis_id,
                    self.sequence_index,
                )

                log.info("Deleted BLAST due to timeout")

                blast_timeout_count += 1

                if blast_timeout_count >= 3:
                    log.info("BLAST exceeded allowed attempts")
                    break

                log.info("Restarting BLAST")

                continue

            except asyncio.CancelledError:
                await self.data.blast.delete_nuvs_blast(
                    self.analysis_id,
                    self.sequence_index,
                )

                log.info("Deleted BLAST due to cancellation")

                break

    async def wait_for_blast_search(self) -> None:
        """Wait until the BLAST search completes.

        Keep check the BLAST status on NCBI with increasingly longer intervals between
        checks.
        """
        interval = 3

        while True:
            await asyncio.sleep(interval)

            blast = await self.data.blast.check_nuvs_blast(
                self.analysis_id,
                self.sequence_index,
            )

            if blast.ready:
                logger.info("retrieved result for blast", rid=blast.rid)
                break

            if blast.error:
                logger.info(
                    "encountered error during blast",
                    rid=blast.rid,
                    error=blast.error,
                )
                await self._set_error(blast.error)
                break

            interval += 5

            logger.info(
                "Checked BLAST. Waiting for result...",
                rid=blast.rid,
                interval=interval,
            )
