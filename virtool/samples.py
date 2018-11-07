PATHOSCOPE_TASK_NAMES = [
    "pathoscope_bowtie",
    "pathoscope_barracuda"
]


def calculate_algorithm_tags(analyses):
    """
    Calculate the algorithm tags (eg. "ip", True) that should be applied to a sample document based on a list of its
    associated analyses.

    :param analyses: the analyses to calculate tags for
    :type analyses: list

    :return: algorithm tags to apply to the sample document
    :rtype: dict

    """
    pathoscope = False
    nuvs = False

    for analysis in analyses:
        if pathoscope is not True and analysis["algorithm"] in PATHOSCOPE_TASK_NAMES:
            pathoscope = analysis["ready"] or "ip" or pathoscope

        if nuvs is not True and analysis["algorithm"] == "nuvs":
            nuvs = analysis["ready"] or "ip" or nuvs

        if pathoscope is True and nuvs is True:
            break

    return {
        "pathoscope": pathoscope,
        "nuvs": nuvs
    }


def get_sample_rights(sample: dict, client):
    if client.administrator or sample["user"]["id"] == client.user_id:
        return True, True

    is_group_member = sample["group"] and sample["group"] in client.groups

    read = sample["all_read"] or (is_group_member and sample["group_read"])

    if not read:
        return False, False

    write = sample["all_write"] or (is_group_member and sample["group_write"])

    return read, write
