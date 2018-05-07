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
    # Build a ``description`` field for the otu creation change document.
    description = "Created {}".format(document["name"])

    # Add the abbreviation to the description if there is one.
    if document["abbreviation"]:
        return "{} ({})".format(description, document["abbreviation"])

    return description
