import dictdiffer

from virtool.models.enums import HistoryMethod


def calculate_diff(old: dict, new: dict) -> list:
    """Calculate the diff for a joined otu document before and after modification.

    :param old: the joined otu document before modification
    :param new: the joined otu document after modification
    :return: the diff

    """
    return list(dictdiffer.diff(old, new))


def compose_create_description(document: dict) -> str:
    """Compose a change description for the creation of a new OTU given its document.

    :param document: the OTU document
    :return: a change description

    """
    name = document["name"]
    abbreviation = document.get("abbreviation")

    # Build a ``description`` field for the otu creation change document.
    description = f"Created {name}"

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def compose_history_description(
    history_method: HistoryMethod,
    name: str,
    abbreviation: str = None,
) -> str:
    """Compose a change description for removing an OTU.

    :param document: the OTU document that is being removed
    :return: a change description

    """
    e = "" if history_method.value[-1] == "e" else "e"

    description = f"{history_method.value.capitalize()}{e}d {name}"

    if abbreviation:
        description = f"{description} ({abbreviation})"

    return description


def derive_otu_information(
    old: dict | None,
    new: dict | None,
) -> tuple[str, str, int | str, str]:
    """Derive OTU information for a new change document
    from the old and new joined OTU documents.

    :param old: the old, joined OTU document
    :param new: the new, joined OTU document
    :return: the parent reference ID and otu ID, name, and abbreviation

    """
    try:
        otu_id = old["_id"]
    except TypeError:
        otu_id = new["_id"]

    try:
        otu_name = old["name"]
    except TypeError:
        otu_name = new["name"]

    try:
        otu_version = int(new["version"])
    except (TypeError, KeyError):
        otu_version = "removed"

    try:
        ref_id = old["reference"]["id"]
    except (TypeError, KeyError):
        ref_id = new["reference"]["id"]

    return otu_id, otu_name, otu_version, ref_id
