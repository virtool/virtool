import virtool.job_resources
from virtool.handlers.utils import json_response


async def get(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.job_resources.get()
    req.app["resources"] = resources
    
    return json_response(resources)


async def get_cuda(req):
    """
    Get a list describing CUDA-capable devices on the host system.

    """
    cuda_devices = virtool.job_resources.get_cuda_devices()
    req.app["resources"]["cuda"] = cuda_devices

    return json_response(req.app["resources"]["cuda"])
