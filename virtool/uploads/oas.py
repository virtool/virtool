from pydantic import ConfigDict
from virtool_core.models.upload import Upload, UploadMinimal


class UploadMinimalResponse(UploadMinimal):
    """A response model for a minimal upload."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {
                    "id": 106,
                    "created_at": "2022-01-22T17:28:21.491000Z",
                    "name": "MPI19_L3_2.fq.gz",
                    "name_on_disk": "106-MPI19_L3_2.fq.gz",
                    "ready": True,
                    "removed": False,
                    "removed_at": None,
                    "reserved": True,
                    "size": 3356803271,
                    "type": "reads",
                    "uploaded_at": "2022-01-22T17:31:59.801000Z",
                    "user": {
                        "administrator": True,
                        "handle": "mrott",
                        "id": "ihvze2u9",
                    },
                },
            ],
        },
    )


class UploadResponse(Upload):
    """A response model for an upload."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 106,
                "created_at": "2022-01-22T17:28:21.491000Z",
                "name": "MPI19_L3_2.fq.gz",
                "name_on_disk": "106-MPI19_L3_2.fq.gz",
                "ready": True,
                "removed": False,
                "removed_at": None,
                "reserved": True,
                "size": 3356803271,
                "type": "reads",
                "uploaded_at": "2022-01-22T17:31:59.801000Z",
                "user": {
                    "administrator": True,
                    "handle": "mrott",
                    "id": "ihvze2u9",
                },
            },
        },
    )
