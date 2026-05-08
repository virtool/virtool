from virtool.pg.utils import SQLEnum


class CacheType(str, SQLEnum):
    """The kinds of artifacts the cache module stores."""

    reference_mapping_index = "reference_mapping_index"
    subtraction_mapping_index = "subtraction_mapping_index"
    sample_trimmed_reads = "sample_trimmed_reads"
