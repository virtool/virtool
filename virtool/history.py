import dictdiffer


def calculate_diff(old, new):
    """
    Calculate the diff for a joined kind document before and after modification.

    :param old: the joined kind document before modification
    :type old: dict

    :param new: the joined kind document after modification
    :type new: dict

    :return: the diff
    :rtype: list

    """
    return list(dictdiffer.diff(old, new))
