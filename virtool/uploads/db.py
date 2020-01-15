import os
import virtool.utils


async def finish_upload(app, file_id):
    path = os.path.join(app["settings"]["data_path"], "files", file_id)

    size = virtool.utils.file_stats(path)["size"]

    await app["db"].files.update_one({"_id": file_id}, {
        "$set": {
            "size": size,
            "ready": True
        }
    })
