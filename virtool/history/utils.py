import dictdiffer


def calculate_diff(old, new):
    """
    Calculate the diff for a joined otu document before and after modification.

    :param old: the joined otu document before modification
    :type old: dict

    :param new: the joined otu document after modification
    :type new: dict

    :return: the diff
    :rtype: list

    """
    return list(dictdiffer.diff(old, new))


def compose_create_description(document):
    name = document["name"]
    abbreviation = document.get("abbreviation", None)

    # Build a ``description`` field for the otu creation change document.
    description = f"Created {name}"

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        return f"{description} ({abbreviation})"

    return description


def compose_edit_description(name, abbreviation, old_abbreviation, schema):
    description = None

    if name:
        description = f"Changed name to {name}"

    if abbreviation is not None:
        # Abbreviation is being removed.
        if abbreviation == "" and old_abbreviation:
            abbreviation_phrase = f"removed abbreviation {old_abbreviation}"

        # Abbreviation is being added where one didn't exist before
        elif abbreviation and not old_abbreviation:
            abbreviation_phrase = f"added abbreviation {abbreviation}"

        # Abbreviation is being changed from one value to another.
        else:
            abbreviation_phrase = f"changed abbreviation to {abbreviation}"

        if description:
            description = f"{description} and {abbreviation_phrase}"
        else:
            description = abbreviation_phrase[:1].upper() + abbreviation_phrase[1:]

    if schema is not None:
        if description:
            description += " and modified schema"
        else:
            description = "Modified schema"

    return description


def compose_remove_description(document):
    name = document["name"]
    abbreviation = document.get("abbreviation", None)

    description = f"Removed {name}"

    if abbreviation:
        return f"{description} ({abbreviation})"

    return description
