"""API request handlers for managing and querying HMM data."""

from aiohttp.web import Response
from aiohttp.web_response import StreamResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r400, r403, r404, r502

from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadGateway, APIConflict, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
    ResourceRemoteError,
)
from virtool.data.utils import get_data_from_req
from virtool.hmm.models import HMM, HMMInstalled, HMMSearchResult
from virtool.models.roles import AdministratorRole
from virtool.mongo.utils import get_mongo_from_req, get_one_field
from virtool.storage.errors import StorageKeyNotFoundError

routes = Routes()


@routes.view("/hmms")
class HMMsView(PydanticView):
    async def get(self) -> r200[HMMSearchResult]:
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
        search_results = await get_data_from_req(self.request).hmms.find(
            self.request.query,
        )

        return json_response(search_results)


@routes.view("/hmms/status")
class StatusView(PydanticView):
    async def get(self) -> r200[Response]:
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
        status = await get_data_from_req(self.request).hmms.get_status()

        return json_response(status)


@routes.view("/hmms/status/release")
class ReleaseView(PydanticView):
    async def get(self) -> r200[Response] | r502:
        """Get the latest HMM release.

        Fetches the latest release for the HMM data.

        Status Codes:
            200: Successful operation
            502: Repository does not exist
            502: Cannot reach GitHub
        """
        try:
            status = await get_data_from_req(self.request).hmms.get_status()
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceRemoteError as err:
            raise APIBadGateway(str(err))

        return json_response(status.release)


@routes.view("/hmms/status/updates")
class UpdatesView(PydanticView):
    async def get(self) -> r200[Response]:
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
    async def post(self) -> r201[HMMInstalled] | r400 | r403:
        """Install HMMs.

        Installs the latest official HMM database from GitHub.

        Status Codes:
            201: Successful operation
            400: Target release does not exist
            403: Not permitted
        """
        try:
            update = await get_data_from_req(self.request).hmms.install_update(
                self.request["client"].user_id,
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceError as err:
            raise APIBadGateway(str(err))

        return json_response(update)


@routes.view("/hmms/{hmm_id}")
class HMMView(PydanticView):
    async def get(self, hmm_id: str, /) -> r200[HMM] | r404:
        """Get an HMM.

        Fetches the details for an HMM annotation.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            hmm = await get_data_from_req(self.request).hmms.get(hmm_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(hmm)


@routes.jobs_api.get("/hmms/{hmm_id}")
async def get(req):
    """Get a HMM annotation document.

    Fetches a complete individual HMM annotation document.
    """
    try:
        hmm = await get_data_from_req(req).hmms.get(req.match_info["hmm_id"])
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(hmm)


@routes.jobs_api.get("/hmms/files/annotations.json.gz")
@routes.get("/hmms/files/annotations.json.gz")
async def get_hmm_annotations(req):
    """Get HMM annotations.

    Fetches a compressed json file containing the database documents for all HMMs.
    """
    try:
        stream, size = await get_data_from_req(req).hmms.download_annotations()
    except ResourceNotFoundError:
        raise APINotFound()

    try:
        first_chunk = await stream.__anext__()
    except (StopAsyncIteration, StorageKeyNotFoundError):
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Disposition": "attachment; filename=annotations.json.gz",
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )

    await response.prepare(req)
    await response.write(first_chunk)

    async for chunk in stream:
        await response.write(chunk)

    return response


@routes.jobs_api.get("/hmms/files/profiles.hmm")
async def get_hmm_profiles(req):
    """Get HMM profiles.

    Downloads the HMM profiles file if HMM data is available.
    """
    try:
        stream, size = await get_data_from_req(req).hmms.download_profiles()
    except ResourceNotFoundError:
        raise APINotFound()

    try:
        first_chunk = await stream.__anext__()
    except (StopAsyncIteration, StorageKeyNotFoundError):
        raise APINotFound()

    response = StreamResponse(
        headers={
            "Content-Disposition": "attachment; filename=profiles.hmm",
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )

    await response.prepare(req)
    await response.write(first_chunk)

    async for chunk in stream:
        await response.write(chunk)

    return response
