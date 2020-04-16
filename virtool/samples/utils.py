import os

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


def calculate_workflow_tags(analyses: list) -> dict:
    """
    Calculate the workflow tags (eg. "ip", True) that should be applied to a sample document based on a list of its
    associated analyses.

    :param analyses: the analyses to calculate tags for
    :return: workflow tags to apply to the sample document

    """
    pathoscope = False
    nuvs = False

    for analysis in analyses:
        if pathoscope is not True and analysis["workflow"] in PATHOSCOPE_TASK_NAMES:
            pathoscope = analysis["ready"] or "ip" or pathoscope

        if nuvs is not True and analysis["workflow"] == "nuvs":
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


def join_legacy_read_path(sample_path: str, suffix: int) -> str:
    """
    Create a path string for a sample read file using the old file name convention (eg. reads_1.fastq).

    :param sample_path: the path to the sample directory
    :param suffix: the read file suffix
    :return: the read path

    """
    return os.path.join(sample_path, f"reads_{suffix}.fastq")


def join_legacy_read_paths(settings: dict, sample):
    """
    Create a list of paths for the read files associated with the `sample`.

    :param settings: the application settings
    :param sample: the sample document
    :return: a list of sample read paths

    """
    sample_path = join_sample_path(settings, sample["_id"])

    if not all(f["raw"] for f in sample["files"]):
        if sample["paired"]:
            return [
                join_legacy_read_path(sample_path, 1),
                join_legacy_read_path(sample_path, 2)
            ]

        return [join_legacy_read_path(sample_path, 1)]


def join_read_paths(base_path: str, paired: bool) -> list:
    """
    Return a list of standard read paths given a base path and flag indicating whether the reads are `paired`.

    The list will contain two paths if the data is paired, and one if it is not.

    :param base_path: a base path where the read files are located
    :param paired: a boolean flag indicating whether the data is paired
    :return: a list of read paths

    """
    if paired:
        return [join_read_path(base_path, suffix) for suffix in (1, 2)]

    return [join_read_path(base_path, 1)]


def join_read_path(base_path: str, suffix: int) -> str:
    """
    Return a standard read path given a base path (eg. /mnt/data/samples/foo) and a read suffix.

    :param base_path: a base path where the read file is located
    :param suffix: the suffix number for the read file
    :return: a read path

    """
    return os.path.join(base_path, f"reads_{suffix}.fq.gz")


def join_sample_path(settings, sample_id):
    return os.path.join(settings["data_path"], "samples", sample_id)
