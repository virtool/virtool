"""
API request handlers for managing and querying HMM data.

"""
from typing import List, Union

import aiohttp
from aiohttp.web import Response
from aiohttp.web_exceptions import (
    HTTPBadGateway,
    HTTPBadRequest,
    HTTPConflict,
    HTTPNoContent,
)
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404, r502
from virtool_core.models.hmm import HMM, HMMSearchResult

import virtool.hmm.db
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.errors import GitHubError
from virtool.github import create_update_subdocument
from virtool.hmm.db import PROJECTION, generate_annotations_json_file
from virtool.hmm.tasks import HMMInstallTask
from virtool.hmm.utils import hmm_data_exists
from virtool.http.policy import policy, PermissionsRoutePolicy
from virtool.http.routes import Routes
from virtool.mongo.utils import get_one_field
from virtool.users.utils import Permission
from virtool.utils import base_processor, compress_file_with_gzip, rm, run_in_thread

routes = Routes()


@routes.view("/hmms")
class HMMsView(PydanticView):
    async def get(self) -> r200[HMMSearchResult]:
        """
        Find HMM annotation documents.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]

        term = self.request.query.get("find")

        db_query = {}

        if term:
            db_query.update(compose_regex_query(term, ["names"]))

        data = await paginate(
            db.hmm,
            db_query,
            self.request.query,
            sort="cluster",
            projection=PROJECTION,
            base_query={"hidden": False},
        )

        data["status"] = await virtool.hmm.db.get_status(db)

        return json_response(data)

    @policy(PermissionsRoutePolicy(Permission.modify_hmm))
    async def delete(self) -> Union[r204, r403]:
        """
        Delete all installed HMM data.

        This won't break analyses that reference the installed HMM data.

        Status Codes:
            204: Successful operation
            403: Not permitted
        """
        db = self.request.app["db"]

        await virtool.hmm.db.purge(db, self.request.app["config"])

        hmm_path = self.request.app["config"].data_path / "hmm/profiles.hmm"

        try:
            await run_in_thread(rm, hmm_path)
        except FileNotFoundError:
            pass

        await db.status.find_one_and_update(
            {"_id": "hmm"}, {"$set": {"installed": None, "task": None, "updates": []}}
        )

        await virtool.hmm.db.fetch_and_update_release(self.request.app)

        raise HTTPNoContent


@routes.view("/hmms/status")
class StatusView(PydanticView):
    async def get(self) -> r200[Response]:
        """
        Get the status of the HMM data. Contains the following fields:

        - `errors`: lists any errors in the HMM data
        - `id`: is always 'hmm'
        - `installed`: a dict describing the installed HMM data
        - `process.id`: the ID of the process installing the HMM data
        - `release`: a dict describing the latest available release

        Installed HMM data cannot currently be updated.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]
        status = await virtool.hmm.db.get_status(db)
        return json_response(status)


@routes.view("/hmms/status/release")
class ReleaseView(PydanticView):
    async def get(self) -> Union[r200[Response], r502]:
        """
        Get the latest release for the HMM data.

        Status Codes:
            200: Successful operation
            502: Repository does not exist
            502: count not reach Github
        """
        try:
            release = await virtool.hmm.db.fetch_and_update_release(self.request.app)
        except GitHubError as err:
            if "404" in str(err):
                raise HTTPBadGateway(text="GitHub repository does not exist")

            raise

        except aiohttp.ClientConnectorError:
            raise HTTPBadGateway(text="Could not reach GitHub")

        if release is None:
            raise NotFound("Release not found")

        return json_response(release)


@routes.view("/hmms/status/updates")
class UpdatesView(PydanticView):
    async def get(self) -> r200[Response]:
        """
        List all updates applied to the HMM collection.

        Status Codes:
            200: Successful operation
        """
        db = self.request.app["db"]

        updates = await get_one_field(db.status, "updates", "hmm") or []
        updates.reverse()

        return json_response(updates)

    @policy(PermissionsRoutePolicy(Permission.modify_hmm))
    async def post(self) -> Union[r201[Response], r400, r403]:
        """
        Install the latest official HMM database from GitHub.

        Status Codes:
            201: Successful operation
            400: Target release does not exist
            403: Not permitted
        """
        db = self.request.app["db"]

        user_id = self.request["client"].user_id

        if await db.status.count_documents({"_id": "hmm", "updates.ready": False}):
            raise HTTPConflict(text="Install already in progress")

        await virtool.hmm.db.fetch_and_update_release(self.request.app)

        release = await get_one_field(db.status, "release", "hmm")

        if release is None:
            raise HTTPBadRequest(text="Target release does not exist")

        task = await self.request.app["tasks"].add(
            HMMInstallTask, context={"user_id": user_id, "release": release}
        )

        await db.status.find_one_and_update(
            {"_id": "hmm"}, {"$set": {"task": {"id": task["id"]}}}
        )

        update = create_update_subdocument(release, False, user_id)

        await db.status.update_one({"_id": "hmm"}, {"$push": {"updates": update}})

        return json_response(update)


@routes.view("/hmms/{hmm_id}")
class HMMView(PydanticView):
    async def get(self) -> Union[r200[HMM], r404]:
        """
        Get a complete individual HMM annotation document.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        document = await self.request.app["db"].hmm.find_one(
            {"_id": self.request.match_info["hmm_id"]}
        )

        if document is None:
            raise NotFound()

        return json_response(base_processor(document))


@routes.jobs_api.get("/hmms/{hmm_id}")
async def get(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document is None:
        raise NotFound()

    return json_response(base_processor(document))


@routes.jobs_api.get("/hmms/files/annotations.json.gz")
@routes.get("/hmms/files/annotations.json.gz")
async def get_hmm_annotations(request):
    """Get a compressed json file containing the database documents for all HMMs."""
    data_path = request.app["config"].data_path
    annotation_path = data_path / "hmm/annotations.json.gz"

    if not annotation_path.exists():
        json_path = await generate_annotations_json_file(request.app)
        await run_in_thread(compress_file_with_gzip, json_path, annotation_path)

    return FileResponse(
        annotation_path,
        headers={
            "Content-Disposition": "attachment; filename=annotations.json.gz",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.jobs_api.get("/hmms/files/profiles.hmm")
async def get_hmm_profiles(req):
    """
    Download the HMM profiles file if HMM data is available.

    """
    file_path = req.app["config"].data_path / "hmm" / "profiles.hmm"

    if not await run_in_thread(hmm_data_exists, file_path):
        raise NotFound("Profiles file could not be found")

    return FileResponse(
        file_path,
        chunk_size=1024 * 1024,
        headers={
            "Content-Disposition": "attachment; filename=profiles.hmm",
            "Content-Type": "application/octet-stream",
        },
    )
