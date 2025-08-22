"""Utilities for parsing FastQC results."""

import statistics
from pathlib import Path

from virtool.quality.models import Quality


def _parse_index_range(base: str) -> range:
    """Parse base position range from FastQC format (e.g., '1' or '10-14')."""
    pos = [int(x) for x in base.split("-")]
    if len(pos) > 1:
        return range(pos[0] - 1, pos[1])
    return range(pos[0] - 1, pos[0])


def _handle_nan_values(values: list[str]) -> list[float]:
    """Handle NaN values in FastQC data lines."""
    # Try to find the first non-NaN value to use as replacement
    for value in values:
        try:
            replacement = float(value)
            return [replacement] * len(values)
        except ValueError:
            continue

    # If all values are NaN, return zeros
    if all(v == "NaN" for v in values):
        return [0.0] * len(values)

    raise ValueError(f"Could not parse values: {values}")


def _parse_basic_stats(lines: list[str]) -> dict:
    """Parse basic statistics section."""
    stats = {"count": 0, "encoding": "", "gc": 0.0, "length": [0, 0]}

    for line in lines:
        if line.startswith("#") or not line.strip():
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            continue

        if "Total Sequences" in line:
            stats["count"] = int(parts[1])
        elif "Encoding" in line:
            stats["encoding"] = parts[1]
        elif "Sequence length" in line:
            length_str = parts[1]
            if "-" in length_str:
                length_range = [int(s) for s in length_str.split("-")]
                stats["length"] = [min(length_range), max(length_range)]
            else:
                length = int(length_str)
                stats["length"] = [length, length]
        elif "%GC" in line:
            stats["gc"] = float(parts[1])

    return stats


def _parse_base_quality(lines: list[str]) -> list[list[float]]:
    """Parse per-base sequence quality section."""
    bases = []
    max_index = -1

    for line in lines:
        if not line.strip() or line.startswith("#"):
            continue

        parts = line.split()
        if len(parts) < 7:  # Base + 6 quality values
            continue

        # Parse quality values (skip first column which is base position)
        try:
            values = [float(v) for v in parts[1:]]
        except ValueError:
            values = _handle_nan_values(parts[1:])

        # Handle position ranges like "10-14"
        indexes = _parse_index_range(parts[0])

        for i in indexes:
            bases.append([round(v, 3) for v in values])

            if i - max_index != 1:
                raise ValueError("Non-contiguous index")
            max_index = i

    return bases


def _parse_nucleotide_composition(lines: list[str]) -> list[list[float]]:
    """Parse per-base sequence content section."""
    composition = []
    max_index = -1

    for line in lines:
        if not line.strip() or line.startswith("#"):
            continue

        parts = line.split()
        if len(parts) < 5:  # Base + G,A,T,C values
            continue

        # Parse nucleotide percentages
        try:
            g, a, t, c = [float(v) for v in parts[1:]]
        except ValueError:
            g, a, t, c = _handle_nan_values(parts[1:])

        # Handle position ranges
        indexes = _parse_index_range(parts[0])

        for i in indexes:
            composition.append([round(g, 1), round(a, 1), round(t, 1), round(c, 1)])

            if i - max_index != 1:
                raise ValueError("Non-contiguous index")
            max_index = i

    return composition


def _parse_sequence_quality(lines: list[str]) -> list[int]:
    """Parse per-sequence quality scores section."""
    sequences = [0] * 50

    for line in lines:
        if not line.strip() or line.startswith("#"):
            continue

        parts = line.split()
        if len(parts) < 2:
            continue

        quality = int(parts[0])
        count = int(float(parts[1]))

        if quality < len(sequences):
            sequences[quality] = count

    return sequences


def _composite_quality(left: Quality, right: Quality) -> Quality:
    """Create composite Quality object from two paired-end read results."""
    # Average base quality data.
    bases = []
    for l_base, r_base in zip(left.bases, right.bases, strict=False):
        bases.append(
            [statistics.mean([l, r]) for l, r in zip(l_base, r_base, strict=False)]
        )

    # Average nucleotide composition
    composition = []
    for l_comp, r_comp in zip(left.composition, right.composition, strict=False):
        composition.append(
            [statistics.mean([l, r]) for l, r in zip(l_comp, r_comp, strict=False)]
        )

    # Combine sequence quality data
    sequences = [l + r for l, r in zip(left.sequences, right.sequences, strict=False)]

    # Combine basic statistics
    return Quality(
        bases=[[round(n, 3) for n in base] for base in bases],
        composition=[[round(n, 1) for n in comp] for comp in composition],
        count=left.count + right.count,
        encoding=left.encoding,
        gc=(left.gc + right.gc) / 2,
        length=[min(left.length + right.length), max(left.length + right.length)],
        sequences=sequences,
    )


def parse_fastqc_file(path: Path) -> Quality:
    """Parse a single FastQC data file."""
    sections = {}
    current_section = None

    with path.open() as f:
        for line in f:
            line = line.rstrip()

            if line.startswith(">>"):
                if ">>END_MODULE" in line:
                    current_section = None
                else:
                    current_section = line.split("\t")[0]  # Remove the pass/fail status
                    sections[current_section] = []
            elif current_section and line:
                sections[current_section].append(line)

    # Parse each section
    basic_stats = _parse_basic_stats(sections.get(">>Basic Statistics", []))

    return Quality(
        bases=_parse_base_quality(sections.get(">>Per base sequence quality", [])),
        composition=_parse_nucleotide_composition(
            sections.get(">>Per base sequence content", [])
        ),
        count=basic_stats["count"],
        encoding=basic_stats["encoding"],
        gc=basic_stats["gc"],
        length=basic_stats["length"],
        sequences=_parse_sequence_quality(
            sections.get(">>Per sequence quality scores", [])
        ),
    )


def parse_fastqc(fastqc_path: Path) -> Quality:
    """Parse the FastQC results at `fastqc_path`.

    All FastQC data except the textual data file are removed.

    :param fastqc_path: the FastQC output data path
    :return: a dict containing a representation of the parsed FastQC data
    """
    quality_objects = []

    # Get the text data files from the FastQC output
    for path in fastqc_path.iterdir():
        if not path.is_dir():
            continue

        for file_path in path.iterdir():
            if file_path.name != "fastqc_data.txt":
                continue

            quality_objects.append(parse_fastqc_file(file_path))

    if len(quality_objects) == 1:
        return quality_objects[0]

    if len(quality_objects) == 2:
        return _composite_quality(quality_objects[0], quality_objects[1])

    raise ValueError(f"Expected 1 or 2 FastQC files, found {len(quality_objects)}")
