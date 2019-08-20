def format_fasta_entry(otu_name, isolate_name, sequence_id, sequence):
    """
    Create a FASTA header for a sequence in a otu DNA FASTA file downloadable from Virtool.

    :param otu_name: the otu name to include in the header
    :type otu_name: str

    :param isolate_name: the isolate name to include in the header
    :type isolate_name: str

    :param sequence_id: the sequence id to include in the header
    :type sequence_id: str

    :param sequence: the sequence for the FASTA entry
    :type sequence: str

    :return: a FASTA entry
    :rtype: str

    """
    return f">{otu_name}|{isolate_name}|{sequence_id}|{len(sequence)}\n{sequence}"


def format_fasta_filename(*args):
    """
    Format a FASTA filename of the form "otu.isolate.sequence_id.fa".

    :param args: the filename parts

    :return: a compound FASTA filename
    :rtype: str

    """
    if len(args) > 3:
        raise ValueError("Unexpected number of filename parts")

    if len(args) == 0:
        raise ValueError("At least one filename part required")

    filename = ".".join(args).replace(" ", "_") + ".fa"

    return filename.lower()
