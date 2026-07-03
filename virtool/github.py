import datetime

import virtool.utils


def create_update_subdocument(
    release: dict,
    ready: bool,
    user_id: int,
    created_at: datetime.datetime | None = None,
) -> dict:
    update = {
        k: release[k]
        for k in release
        if k not in ("content_type", "download_url", "etag", "retrieved_at")
    }

    return {
        **update,
        "created_at": created_at or virtool.utils.timestamp(),
        "ready": ready,
        "user": {"id": user_id},
    }
