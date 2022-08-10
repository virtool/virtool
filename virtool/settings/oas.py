from pydantic import BaseModel, Field, constr
from virtool_core.models.settings import Settings


class GetSettingsResponse(Settings):
    class Config:
        schema_extra = {
            "example": {
                "default_source_types": ["isolate", "strain"],
                "enable_api": True,
                "enable_sentry": True,
                "hmm_slug": "virtool/virtool-hmm",
                "minimum_passsword_length": 8,
                "sample_all_read": False,
                "sample_all_write": True,
                "sample_group": "force_choice",
                "sample_group_read": True,
                "sample_group_write": True,
                "sample_unique_names": False,
            }
        }


class UpdateSettingsSchema(BaseModel):
    sample_group: str = "none"
    sample_group_read: bool = True
    sample_group_write: bool = False
    sample_all_read: bool = True
    sample_all_write: bool = False
    sample_unique_names: bool = True
    hmm_slug: constr(strip_whitespace=True) = "virtool/virtool-hmm"
    enable_api: bool = False
    enable_sentry: bool = True
    minimum_password_length: int = 8
    default_source_types: list = Field(default_factory=lambda: ["isolate", "strain"])


class UpdateSettingsResponse(Settings):
    class Config:
        schema_extra = {
            "example": {
                "default_source_types": ["strain"],
                "enable_api": True,
                "enable_sentry": True,
                "hmm_slug": "virtool/virtool-hmm",
                "minimum_passsword_length": 12,
                "sample_all_read": False,
                "sample_unique_names": False,
            }
        }
