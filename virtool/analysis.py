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
    document = dict(document)
    document["analysis_id"] = document.pop("_id")

    return document
