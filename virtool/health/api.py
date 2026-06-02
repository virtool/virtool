from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r503

from virtool.api.custom_json import json_response
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_req
from virtool.health.models import Liveness, Readiness

routes = Routes()


@routes.view("/health/live")
@routes.jobs_api.view("/health/live")
class LivenessView(PydanticView):
    @policy(PublicRoutePolicy)
    async def get(self) -> r200[Liveness]:
        """Check liveness.

        Reports that the API process is alive and able to serve requests. No backing
        services are checked, so this endpoint will not cause an orchestrator to
        restart the process while a dependency is unavailable.

        Status Codes:
            200: Process is alive
        """
        return json_response(Liveness(status="alive"))


@routes.view("/health/ready")
@routes.jobs_api.view("/health/ready")
class ReadinessView(PydanticView):
    @policy(PublicRoutePolicy)
    async def get(self) -> r200[Readiness] | r503[Readiness]:
        """Check readiness.

        Reports whether the API can reach its backing services. The response includes a
        per-dependency breakdown under ``checks``. Returns ``503`` when any dependency
        is unreachable.

        Status Codes:
            200: Ready to serve requests
            503: One or more dependencies are unavailable
        """
        readiness = await get_data_from_req(self.request).health.check_readiness()

        return json_response(readiness, status=200 if readiness.ready else 503)
