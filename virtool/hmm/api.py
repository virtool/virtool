"""API request handlers for managing and querying HMM data."""

from typing import Literal

from aiohttp.web import Response
from aiohttp.web_fileresponse import FileResponse
from virtool_core.models.hmm import HMM, HMMInstalled, HMMSearchResult
from virtool_core.models.roles import AdministratorRole

from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadGateway, APIConflict, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R400, R403, R404, R502
from virtool.api.view import APIView
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
    ResourceRemoteError,
)
from virtool.mongo.utils import get_mongo_from_req, get_one_field

routes = Routes()


HMMFileNames = Literal["annotations.json.gz", "profiles.hmm"]


@routes.web.view("/hmms")
class HmmsView(APIView):
    async def get(self) -> R200[HMMSearchResult]:
        """Find HMMs.

        Lists profile hidden Markov model (HMM) annotations that are used in Virtool for
        novel virus prediction.

        Providing a search term will return HMMs with full or partial matches in the
        `names` attribute.

        Each HMM annotation is generated from numerous public viral protein sequences.
        The top three most common names in the protein records are combined into the
        `names` attribute.

        Status Codes:
            200: Successful operation
        """
        search_results = await self.data.hmms.find(self.request.query)
        return json_response(search_results)


@routes.web.view("/hmms/status")
class StatusView(APIView):
    async def get(self) -> R200[Response]:
        """Get HMM status.

        Lists the installation status of the HMM data. Contains the following
        fields:

        | Field      | Type          | Description                                               |
        | :--------- | :------------ | :-------------------------------------------------------- |
        | `errors`   | array[string] | An array of any errors in the HMM data                    |
        | `installed`| object        | A description of the currently installed HMM release      |
        | `task.id`  | integer       | The `id` the task responsible for installing the HMM data |
        | `release`  | object        | A description of the latest available release             |

        **Installed HMM data cannot currently be updated**.

        Status Codes:
            200: Successful operation
        """
        status = await self.data.hmms.get_status()
        return json_response(status)


@routes.web.view("/hmms/status/release")
class ReleaseView(APIView):
    async def get(self) -> R200[Response] | R502:
        """Get the latest HMM release.

        Fetches the latest release for the HMM data.

        Status Codes:
            200: Successful operation
            502: Repository does not exist
            502: Cannot reach GitHub
        """
        try:
            status = await self.data.hmms.get_status()
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceRemoteError as err:
            raise APIBadGateway(str(err))

        return json_response(status.release)


@routes.web.view("/hmms/status/updates")
class UpdatesView(APIView):
    async def get(self) -> R200[Response]:
        """List updates.

        Lists all updates applied to the HMM collection.

        Status Codes:
            200: Successful operation
        """
        mongo = get_mongo_from_req(self.request)

        updates = await get_one_field(mongo.status, "updates", "hmm") or []
        updates.reverse()

        return json_response(updates)

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def post(self) -> R201[HMMInstalled] | R400 | R403:
        """Install HMMs.

        Installs the latest official HMM database from GitHub.

        Status Codes:
            201: Successful operation
            400: Target release does not exist
            403: Not permitted
        """
        try:
            update = await self.data.hmms.install_update(
                self.request["client"].user_id,
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceError as err:
            raise APIBadGateway(str(err))

        return json_response(update)


@routes.job.view("/hmms/{hmm_id}")
@routes.web.view("/hmms/{hmm_id}")
class HMMView(APIView):
    async def get(self, hmm_id: str, /) -> R200[HMM] | R404:
        """Get an HMM.

        Fetches the details for an HMM annotation.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            hmm = await self.data.hmms.get(hmm_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(hmm)


@routes.web.view("/hmms/files/{file_name}")
@routes.job.view("/hmms/files/{file_name}")
class HMMsFilesView(APIView):
    async def get(self, file_name: HMMFileNames, /) -> R200[Response] | R404:
        """Get an HMM file.

        Downloads an HMM file.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            match file_name:
                case "annotations.json.gz":
                    path = await self.data.hmms.get_annotations_path()

                case "profiles.hmm":
                    path = await self.data.hmms.get_profiles_path()

                case _:
                    raise APINotFound()

        except ResourceNotFoundError:
            raise APINotFound()

        return FileResponse(
            path,
            chunk_size=1024 * 1024,
            headers={
                "Content-Disposition": f"attachment; filename={file_name}",
                "Content-Type": "application/octet-stream",
            },
        )
