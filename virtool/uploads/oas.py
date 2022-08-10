from virtool_core.models.upload import UploadMinimal, Upload


class GetUploadsResponse(UploadMinimal):
    class Config:
        schema_extra = {
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
                }
            ]
        }


class CreateUploadResponse(Upload):
    class Config:
        schema_extra = {
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
            }
        }
