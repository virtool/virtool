from virtool.pg.utils import SQLEnum


class CacheType(str, SQLEnum):
    """The kinds of artifacts the cache module stores."""

    reference_mapping_index = "reference_mapping_index"
    subtraction_mapping_index = "subtraction_mapping_index"
    trimmed_reads = "trimmed_reads"
