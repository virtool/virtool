async def shutdown(req):
    await req.app.shutdown()
