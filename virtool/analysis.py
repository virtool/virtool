import virtool.utils


LIST_PROJECTION = [
    "_id",
    "name",
    "algorithm",
    "timestamp",
    "ready",
    "job",
    "index_version",
    "user_id",
    "sample_id"
]


def processor(document):
    return virtool.utils.base_processor(document)
