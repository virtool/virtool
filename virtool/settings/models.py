from virtool.models import BaseModel


class Settings(BaseModel):
    default_source_types: list = ["isolate", "strain"]
    enable_api: bool = False
    enable_sentry: bool = True
    hmm_slug: str = "virtool/virtool-hmm"
    minimum_password_length: int = 8
    sample_all_read: bool = True
    sample_all_write: bool = False
    sample_group: int | str | None = None
    sample_group_read: bool = True
    sample_group_write: bool = False
    sample_unique_names: bool = True

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
                "sample_unique_names": True,
            }
        }
