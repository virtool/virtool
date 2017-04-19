from Bio import Entrez, SeqIO

from virtool.handlers.utils import json_response, not_found


def get(req):
    """
    Retrieve the Genbank data associated with the given accession and transform it into a Virtool-style sequence
    document.

    """
    accession = req.match_info["accession"]

    print(accession)

    Entrez.tool = "Virtool"
    Entrez.email = "dev@virtool.ca"

    term = "{}[accn]".format(accession)

    gi_handle = Entrez.esearch(db="nucleotide", term=term)
    gi_record = Entrez.read(gi_handle)

    gi_list = gi_record["IdList"]

    if len(gi_list) == 1:
        gb_handle = Entrez.efetch(db="nuccore", id=gi_list[0], rettype="gb", retmode="text")
        gb_record = list(SeqIO.parse(gb_handle, "gb"))

        seq_record = gb_record[0]

        data = {
            "accession": seq_record.name,
            "sequence": str(seq_record.seq),
            "definition": seq_record.description,
            "host": ""
        }

        for feature in seq_record.features:
            for key, value in feature.qualifiers.items():
                if key == "host":
                    data["host"] = value[0]

        return json_response(data)

    return not_found()
