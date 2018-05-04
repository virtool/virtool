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
