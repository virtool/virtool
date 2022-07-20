from aiohttp.web_routedef import RouteTableDef


class Routes(RouteTableDef):
    def __init__(self):
        super().__init__()
        self.jobs_api = RouteTableDef()
