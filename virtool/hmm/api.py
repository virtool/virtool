"""
API request handlers for managing and querying HMM data.

"""
import asyncio
from typing import Union

from aiohttp.web import Response
from aiohttp.web_exceptions import (
    HTTPBadGateway,
    HTTPBadRequest,
    HTTPConflict,
)
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r400, r403, r404, r502
from virtool_core.models.hmm import HMM, HMMSearchResult, HMMInstalled
from virtool_core.models.roles import AdministratorRole

from virtool.api.response import NotFound, json_response
from virtool.config import get_config_from_req
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceRemoteError,
    ResourceConflictError,
    ResourceError,
)
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes
from virtool.mongo.utils import get_one_field

routes = Routes()


@routes.view("/hmms")
class HmmsView(PydanticView):
    async def get(self) -> r200[HMMSearchResult]:
        """
        Find HMMs.

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
        search_results = await get_data_from_req(self.request).hmms.find(
            self.request.query
        )

        return json_response(search_results)


@routes.view("/hmms/status")
class StatusView(PydanticView):
    async def get(self) -> r200[Response]:
        """
        Get HMM status.

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
        status = await get_data_from_req(self.request).hmms.get_status()

        return json_response(status)


@routes.view("/hmms/status/release")
class ReleaseView(PydanticView):
    async def get(self) -> Union[r200[Response], r502]:
        """
        Get the latest HMM release.

        Fetches the latest release for the HMM data.

        Status Codes:
            200: Successful operation
            502: Repository does not exist
            502: Cannot reach GitHub
        """
        try:
            status = await get_data_from_req(self.request).hmms.get_status()
        except ResourceNotFoundError:
            raise NotFound
        except ResourceRemoteError as err:
            raise HTTPBadGateway(text=str(err))

        return json_response(status.release)


@routes.view("/hmms/status/updates")
class UpdatesView(PydanticView):
    async def get(self) -> r200[Response]:
        """
        List updates.

        Lists all updates applied to the HMM collection.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]

        updates = await get_one_field(db.status, "updates", "hmm") or []
        updates.reverse()

        return json_response(updates)

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def post(self) -> Union[r201[HMMInstalled], r400, r403]:
        """
        Install HMMs.

        Installs the latest official HMM database from GitHub.

        Status Codes:
            201: Successful operation
            400: Target release does not exist
            403: Not permitted
        """
        try:
            update = await get_data_from_req(self.request).hmms.install_update(
                self.request["client"].user_id
            )
        except ResourceConflictError as err:
            raise HTTPConflict(text=str(err))
        except ResourceError as err:
            raise HTTPBadRequest(text=str(err))

        return json_response(update)


@routes.view("/hmms/{hmm_id}")
class HMMView(PydanticView):
    async def get(self, hmm_id: str, /) -> Union[r200[HMM], r404]:
        """
        Get an HMM.

        Fetches the details for an HMM annotation.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            hmm = await get_data_from_req(self.request).hmms.get(hmm_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(hmm)


@routes.jobs_api.get("/hmms/{hmm_id}")
async def get(req):
    """
    Get a HMM annotation document.

    Fetches a complete individual HMM annotation document.
    """
    try:
        hmm = await get_data_from_req(req).hmms.get(req.match_info["hmm_id"])
    except ResourceNotFoundError:
        raise NotFound()

    return json_response(hmm)


@routes.jobs_api.get("/hmms/files/annotations.json.gz")
@routes.get("/hmms/files/annotations.json.gz")
async def get_hmm_annotations(req):
    """
    Get HMM annotations.

    Fetches a compressed json file containing the database documents for all HMMs.
    """

    hmm_path = get_config_from_req(req).data_path / "hmm"
    await asyncio.to_thread(hmm_path.mkdir, parents=True, exist_ok=True)

    path = await get_data_from_req(req).hmms.get_annotations_path()

    return FileResponse(
        path,
        headers={
            "Content-Disposition": "attachment; filename=annotations.json.gz",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.jobs_api.get("/hmms/files/profiles.hmm")
async def get_hmm_profiles(req):
    """
    Get HMM profiles.

    Downloads the HMM profiles file if HMM data is available.

    """
    hmm_path = req.app["config"].data_path / "hmm"
    await asyncio.to_thread(hmm_path.mkdir, parents=True, exist_ok=True)

    try:
        path = await get_data_from_req(req).hmms.get_profiles_path()
    except ResourceNotFoundError:
        raise NotFound

    return FileResponse(
        path,
        chunk_size=1024 * 1024,
        headers={
            "Content-Disposition": "attachment; filename=profiles.hmm",
            "Content-Type": "application/octet-stream",
        },
    )
