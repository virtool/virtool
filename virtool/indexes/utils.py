from pathlib import Path


def check_index_file_type(file_name: str) -> str:
    """
    Get the index file type based on the extension of given `file_name`

    :param file_name: index file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"
    elif file_name.endswith(".json.gz"):
        return "json"
    else:
        return "bowtie2"


def join_index_path(data_path: Path, reference_id: str, index_id: str) -> Path:
    """
    Return the path to an index.

    :param data_path: the application data path
    :param reference_id: the ID of the parent reference
    :param index_id: the ID of the index
    :return: the index path
    """
    return data_path / "references" / reference_id / index_id


OTU_KEYS = ["name", "abbreviation", "schema"]
