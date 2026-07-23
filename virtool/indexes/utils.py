def compose_index_file_key(storage_key: str, filename: str) -> str:
    return f"indexes/{storage_key}/{filename}"


def compose_index_prefix(storage_key: str) -> str:
    return f"indexes/{storage_key}/"
