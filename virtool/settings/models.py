from virtool_core.models.basemodel import BaseModel


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
