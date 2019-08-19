import pytest

import virtool.db.downloads


def test_format_fasta_entry():
    virus_name = "Tobacco mosaic virus"
    isolate_name = "Isolate A"
    sequence_id = "AX12345"
    sequence = "ATAGAGTTACGAGCGACTACGACT"

    entry = virtool.db.downloads.format_fasta_entry(
        virus_name,
        isolate_name,
        sequence_id,
        sequence
    )

    assert entry == ">Tobacco mosaic virus|Isolate A|AX12345|24\nATAGAGTTACGAGCGACTACGACT"



@pytest.mark.parametrize("parts,filename", [
    (("Tobacco mosaic virus", "Isolate A", "AX12345", "foobar"), None),
    (("Tobacco mosaic virus", "Isolate A", "AX12345"), "tobacco_mosaic_virus.isolate_a.ax12345.fa"),
    (("Tobacco mosaic virus", "Isolate A"), "tobacco_mosaic_virus.isolate_a.fa"),
    (("Tobacco mosaic virus",), "tobacco_mosaic_virus.fa"),
    ((), None),
])
def test_format_fasta_filename(parts, filename):
    if not parts or len(parts) > 3:
        with pytest.raises(ValueError) as excinfo:
            virtool.db.downloads.format_fasta_filename(*parts)

        assert "Too many filename parts" if parts else "At least one filename part required" in str(excinfo.value)

    else:
        assert virtool.db.downloads.format_fasta_filename(*parts) == filename


async def test_generate_sequence_fasta(dbi, test_otu, test_sequence):
    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    expected = (
        "prunus_virus_f.isolate_8816-v2.kx269872.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC"
    )

    assert await virtool.db.downloads.generate_sequence_fasta(dbi, test_sequence["_id"]) == expected


async def test_generate_isolate_fasta(dbi, test_otu, test_sequence):
    await dbi.otus.insert_one(test_otu)

    await dbi.sequences.insert_many([
        test_sequence,
        dict(test_sequence, _id="AX12345", sequence="ATAGAGGAGTTA")
    ])

    expected = (
        "prunus_virus_f.isolate_8816-v2.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC\n"
        ">Prunus virus F|Isolate 8816-v2|AX12345|12\nATAGAGGAGTTA"
    )

    assert await virtool.db.downloads.generate_isolate_fasta(
        dbi,
        test_otu["_id"],
        test_otu["isolates"][0]["id"]
    ) == expected


async def test_generate_virus_fasta(dbi, test_otu, test_sequence):
    await dbi.otus.insert_one(
        dict(test_otu, isolates=[
            *test_otu["isolates"],
            {
                "id": "baz",
                "source_type": "isolate",
                "source_name": "A"
            }
        ])
    )

    await dbi.sequences.insert_many([
        test_sequence,
        dict(test_sequence, _id="AX12345", sequence="ATAGAGGAGTTA", isolate_id="baz")
    ])

    expected = (
        "prunus_virus_f.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC\n"
        ">Prunus virus F|Isolate A|AX12345|12\nATAGAGGAGTTA"
    )

    assert await virtool.db.downloads.generate_otu_fasta(dbi, test_otu["_id"]) == expected
