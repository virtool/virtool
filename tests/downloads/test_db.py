import virtool.downloads.db


async def test_generate_sequence_fasta(dbi, test_otu, test_sequence):
    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    expected = (
        "prunus_virus_f.isolate_8816-v2.kx269872.fa",
        ">Prunus virus F|Isolate 8816-v2|KX269872|27\nTGTTTAAGAGATTAAACAACCGCTTTC"
    )

    assert await virtool.downloads.db.generate_sequence_fasta(dbi, test_sequence["_id"]) == expected


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

    assert await virtool.downloads.db.generate_isolate_fasta(
        dbi,
        test_otu["_id"],
        test_otu["isolates"][0]["id"]
    ) == expected

