from virtool.models.base import BaseModel


class Liveness(BaseModel):
    status: str

    class Config:
        schema_extra = {"example": {"status": "alive"}}


class ReadinessChecks(BaseModel):
    mongodb: bool
    postgres: bool


class Readiness(BaseModel):
    ready: bool
    checks: ReadinessChecks

    class Config:
        schema_extra = {
            "example": {
                "ready": True,
                "checks": {"mongodb": True, "postgres": True},
            }
        }
