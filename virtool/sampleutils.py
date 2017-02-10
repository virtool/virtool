PATHOSCOPE_TASK_NAMES = ["pathoscope_bowtie", "pathoscope_snap"]


def calculate_algorithm_tags(analyses):
    update = {
        "pathoscope": False,
        "nuvs": False
    }

    pathoscope = list()
    nuvs = list()

    for analysis in analyses:
        if analysis["algorithm"] in PATHOSCOPE_TASK_NAMES:
            pathoscope.append(analysis)

        if analysis["algorithm"] == "nuvs":
            nuvs.append(analysis)

    if len(pathoscope) > 0:
        update["pathoscope"] = any([document["ready"] for document in pathoscope]) or "ip"

    if len(nuvs) > 0:
        update["nuvs"] = any([document["ready"] for document in nuvs]) or "ip"

    return update

