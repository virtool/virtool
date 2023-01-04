from pydantic import BaseModel


class ListPermissionsResponse(BaseModel):
    class Config:
        schema_extra = {
            "example": [
                {
                    "id": 1,
                    "name": "create_sample",
                    "description": "Required for creating a sample",
                    "resource_type": "app",
                    "action": "create",
                },
                {
                    "id": 2,
                    "name": "modify_subtraction",
                    "description": "Required for modifying a subtraction",
                    "resource_type": "app",
                    "action": "modify",
                },
            ]
        }
