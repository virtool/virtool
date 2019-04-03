PATHOSCOPE_TASK_NAMES = [
    "pathoscope_bowtie",
    "pathoscope_barracuda"
]

LEGACY_TRIM_PARAMETERS = {
    "program": "skewer",
    "m": "pe",
    "l": "20",
    "q": "20",
    "Q": "25"
}

TRIM_PARAMETERS = {
    "end_quality": "20",
    "mode": "pe",
    "max_error_rate": "0.1",
    "max_indel_rate": "0.03",
    "max_length": None,
    "mean_quality": "25",
    "min_length": "20"
}


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



