"""Provides request handlers for file downloads.

TODO: Remove this module.
"""

from aiohttp import web

from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.status import R200, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceNotFoundError

routes = Routes()


@routes.web.view("/download/otus/{otu_id}/isolates/{isolate_id}")
class DownloadIsolateView(APIView):
    async def get(self, otu_id: str, isolate_id: str, /) -> R200 | R404:
        """Download an isolate FASTA.

        Downloads a FASTA file containing the sequences for a single isolate.
        """
        try:
            filename, fasta = await self.data.otus.get_isolate_fasta(
                otu_id,
                isolate_id,
            )
        except ResourceNotFoundError as err:
            if "OTU does not exist" in str(err):
                raise APINotFound("OTU not found")

            if "Isolate does not exist" in str(err):
                raise APINotFound("Isolate not found")

            raise

        return web.Response(
            text=fasta,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )


@routes.web.view("/download/sequences/{sequence_id}")
class DownloadSequenceView(APIView):
    async def get(self, sequence_id: str, /) -> R200 | R404:
        """Download a sequence FASTA

        Downloads a file containing the nucleotdie sequence for a single Virtool
        sequence.
        """
        try:
            filename, fasta = await self.data.otus.get_sequence_fasta(
                sequence_id,
            )
        except ResourceNotFoundError as err:
            if "Sequence does not exist" in str(err):
                raise APINotFound("Sequence not found")

            if "Isolate does not exist" in str(err):
                raise APINotFound("Isolate not found")

            if "OTU does not exist" in str(err):
                raise APINotFound("OTU not found")

            raise

        if fasta is None:
            return web.Response(status=404)

        return web.Response(
            text=fasta,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
