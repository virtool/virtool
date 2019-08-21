import pytest

import virtool.downloads


def test_format_fasta_entry():
    virus_name = "Tobacco mosaic virus"
    isolate_name = "Isolate A"
    sequence_id = "AX12345"
    sequence = "ATAGAGTTACGAGCGACTACGACT"

    entry = virtool.downloads.utils.format_fasta_entry(
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
            virtool.downloads.utils.format_fasta_filename(*parts)

        assert "Too many filename parts" if parts else "At least one filename part required" in str(excinfo.value)

    else:
        assert virtool.downloads.utils.format_fasta_filename(*parts) == filename
