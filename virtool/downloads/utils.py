"""
Utilities focussing on formatting FASTA files.

"""


def format_fasta_entry(otu_name: str, isolate_name: str, sequence_id: str, sequence: str) -> str:
    """
    Create a FASTA header and sequence block for a sequence in a otu DNA FASTA file downloadable from Virtool.

    :param otu_name: the otu name to include in the header
    :param isolate_name: the isolate name to include in the header
    :param sequence_id: the sequence id to include in the header
    :param sequence: the sequence for the FASTA entry
    :return: a FASTA entry

    """
    return f">{otu_name}|{isolate_name}|{sequence_id}|{len(sequence)}\n{sequence}"


def format_fasta_filename(*args) -> str:
    """
    Format a FASTA filename of the form "otu.isolate.sequence_id.fa".

    :param args: the filename parts
    :return: a compound FASTA filename

    """
    if len(args) > 3:
        raise ValueError("Unexpected number of filename parts")

    if len(args) == 0:
        raise ValueError("At least one filename part required")

    filename = ".".join(args).replace(" ", "_") + ".fa"

    return filename.lower()


def format_subtraction_filename(subtraction_id: str, subtraction_name: str) -> str:
    """
    Format a subtraction filename of the form "subtraction-subtraction_id-subtraction_name.fa.gz".

    :param subtraction_id: the subtraction id
    :param subtraction_name: the subtraction name
    :return: a compound subtraction filename

    """
    name = subtraction_name.replace(" ", "-").lower()
    return f"subtraction-{subtraction_id}-{name}.fa.gz"
