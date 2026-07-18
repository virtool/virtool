def check_index_file_type(file_name: str) -> str:
    """Get the index file type based on the extension of given `file_name`

    :param file_name: index file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"

    if file_name.endswith(".json.gz"):
        return "json"

    return "bowtie2"


def compose_index_file_key(storage_key: str, filename: str) -> str:
    return f"indexes/{storage_key}/{filename}"


def compose_index_prefix(storage_key: str) -> str:
    return f"indexes/{storage_key}/"
