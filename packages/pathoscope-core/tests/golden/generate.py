"""Generate the golden-vector corpus from the pre-move PyO3 build.

This script is the provenance record for `vectors.json`. It is not run by CI
and is not part of the crate's build; it exists so the corpus can be
regenerated and audited against the implementation it was captured from.

It must be run against the *old* Python extension module, before any
behaviour-affecting change:

    PYTHONPATH=/path/to/workflow-pathoscope/python \
    PATH=/path/to/bowtie2:$PATH \
    python3 generate.py

Floats are written as ordinary JSON numbers. Both Python's `json` and Rust's
`serde_json` emit the shortest representation that round-trips, so parsing a
vector back on either side yields the bit-identical f64. The comparison
harness compares `f64::to_bits()`, not text, so a formatting difference
between the two emitters cannot mask or manufacture a mismatch.
"""

import hashlib
import json
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from workflow_pathoscope.rust import (
    find_candidate_otus_with_bowtie2,
    run_eliminate_subtraction,
    run_expectation_maximization,
)

HERE = Path(__file__).resolve().parent
FIXTURES = HERE.parent / "fixtures"

RESULT_FIELDS = (
    "best_hit_initial_reads",
    "best_hit_initial",
    "level_1_initial",
    "level_2_initial",
    "best_hit_final_reads",
    "best_hit_final",
    "level_1_final",
    "level_2_final",
    "init_pi",
    "pi",
    "refs",
    "reads",
)

# (name, alignment fixture, p_score_cutoff)
#
# `test_em_integration.sam` and `to_isolates.sam` are absent deliberately.
# Both are malformed-input fixtures — the first carries a record whose CIGAR
# and sequence lengths disagree, the second has no usable header — and the EM
# entry point errors on each. They are vectored as error cases below.
EM_CASES = (
    ("em_basic_cutoff_0", "test_basic.sam", 0.0),
    ("em_basic_cutoff_0.01", "test_basic.sam", 0.01),
    ("em_cutoff_fixture", "test_cutoff.sam", 0.01),
    ("em_multimapping_cutoff_0", "test_em_with_multimapping.sam", 0.0),
    ("em_multimapping_cutoff_0.01", "test_em_with_multimapping.sam", 0.01),
    ("em_multimapping_cutoff_0.5", "test_em_with_multimapping.sam", 0.5),
    ("em_isolates_minimal", "test_isolates_minimal.sam", 0.01),
    ("em_subtraction_minimal", "test_subtraction_minimal.sam", 0.01),
    ("em_to_subtraction", "to_subtraction.sam", 0.01),
)

# EM inputs that must fail. The port has to reject them too — a change that
# made either parse would be a behaviour change, not a fix.
EM_ERROR_CASES = (
    ("em_error_truncated_record", "test_em_integration.sam", 0.01),
    ("em_error_unreadable_header", "to_isolates.sam", 0.01),
)

# (name, isolate fixture, subtraction fixture, fastq fixture, proc)
SUBTRACTION_CASES = (
    (
        "subtraction_minimal",
        "test_isolates_minimal.sam",
        "test_subtraction_minimal.sam",
        "subtraction_minimal_reads.fq",
        4,
    ),
    (
        "subtraction_none_eliminated",
        "to_subtraction.sam",
        "test_subtraction_minimal.sam",
        "to_subtraction_reads.fq",
        4,
    ),
    (
        "subtraction_disjoint",
        "test_isolates_minimal.sam",
        "to_subtraction.sam",
        "subtraction_minimal_reads.fq",
        1,
    ),
)

# (name, reference fixture, reads fixture, proc, p_score_cutoff)
#
# The synthetic reads score 180 against ref0/ref1 and 90 against ref2, so the
# three cutoffs below select all three references, only the two full-length
# ones, and none at all.
CANDIDATE_CASES = (
    ("candidates_cutoff_0.01", "candidates_reference.fa", "candidates_reads.fq", 1, 0.01),
    ("candidates_cutoff_100", "candidates_reference.fa", "candidates_reads.fq", 1, 100.0),
    ("candidates_cutoff_200", "candidates_reference.fa", "candidates_reads.fq", 1, 200.0),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sparse_coverage(values: list[int]) -> dict:
    """Encode a coverage array as its length plus its non-zero positions.

    Coverage arrays are sized to the reference, so a vector over a 50 kb
    reference is 50,000 entries of which ~200 are non-zero. Storing them
    densely made the corpus 1.3 MB, 98% of it zeros. This is lossless — the
    harness rebuilds the dense array and compares element by element.
    """
    return {
        "length": len(values),
        "nonzero": {str(i): v for i, v in enumerate(values) if v != 0},
    }


def write_candidate_fixtures() -> None:
    """Write the synthetic reference and reads the `candidates` vectors use.

    `candidates` is the one entry point that needs a bowtie2 index, and the
    real index in the `virtool/examples` image is ~20 MB. These three short
    references index in well under a second, so the harness can build the
    index at test time and nothing binary has to be committed.
    """
    random.seed(2861)

    refs = {f"ref{i}": "".join(random.choice("ACGT") for _ in range(600)) for i in range(3)}

    with (FIXTURES / "candidates_reference.fa").open("w") as fh:
        for name, seq in refs.items():
            fh.write(f">{name}\n")

            for start in range(0, len(seq), 60):
                fh.write(seq[start : start + 60] + "\n")

    records = [
        (f"{name}_read{k}", refs[name][50 + k * 100 : 110 + k * 100])
        for name in ("ref0", "ref1")
        for k in range(4)
    ]

    # Half length, so it scores 90 rather than 180 and a cutoff between the
    # two selects ref0 and ref1 but not ref2.
    records.append(("ref2_read_short", refs["ref2"][100:130]))

    # Aligns nowhere, so `--no-unal` drops it before the cutoff is applied.
    records.append(("noise_read", "".join(random.choice("ACGT") for _ in range(60))))

    with (FIXTURES / "candidates_reads.fq").open("w") as fh:
        for name, seq in records:
            fh.write(f"@{name}\n{seq}\n+\n{'I' * len(seq)}\n")


def write_read_fastq(sam: Path, out: Path) -> None:
    """Write a FASTQ carrying every mapped read name in `sam`.

    `eliminate_subtraction` filters the FASTQ by read name, so the records
    only have to exist and be uniquely named. Sequence and quality are taken
    from the SAM so the fixture stays self-consistent.
    """
    seen = {}

    for line in sam.read_text().splitlines():
        if line.startswith("@") or not line.strip():
            continue

        fields = line.split("\t")

        if len(fields) < 11:
            continue

        seen.setdefault(fields[0], (fields[9], fields[10]))

    with out.open("w") as fh:
        for name, (seq, qual) in seen.items():
            if set(qual) == {"*"} or len(qual) != len(seq):
                qual = "I" * len(seq)

            fh.write(f"@{name}\n{seq}\n+\n{qual}\n")


def build_em_vectors() -> list[dict]:
    vectors = []

    for name, fixture, cutoff in EM_CASES:
        path = FIXTURES / fixture
        results = run_expectation_maximization(str(path), cutoff)

        vectors.append(
            {
                "name": name,
                "subcommand": "em",
                "args": {"alignment": fixture, "p_score_cutoff": cutoff},
                "result": {
                    **{field: list(getattr(results, field)) for field in RESULT_FIELDS},
                    "coverage": {
                        key: sparse_coverage(value)
                        for key, value in results.coverage.items()
                    },
                },
            }
        )

        print(f"  {name}: {len(results.refs)} refs, {len(results.reads)} reads")

    for name, fixture, cutoff in EM_ERROR_CASES:
        try:
            run_expectation_maximization(str(FIXTURES / fixture), cutoff)
        except Exception:
            vectors.append(
                {
                    "name": name,
                    "subcommand": "em",
                    "args": {"alignment": fixture, "p_score_cutoff": cutoff},
                    "expect_failure": True,
                }
            )
            print(f"  {name}: fails as expected")
        else:
            sys.exit(f"{name} was expected to fail but did not")

    return vectors


def build_subtraction_vectors() -> list[dict]:
    vectors = []

    for name, isolate, subtraction, fastq, proc in SUBTRACTION_CASES:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            out_alignments = tmp_path / "subtracted.bam"
            out_fastq = tmp_path / "subtracted.fq"

            subtracted = run_eliminate_subtraction(
                str(FIXTURES / isolate),
                str(FIXTURES / subtraction),
                str(out_alignments),
                str(FIXTURES / fastq),
                str(out_fastq),
                proc,
            )

            vectors.append(
                {
                    "name": name,
                    "subcommand": "eliminate-subtraction",
                    "args": {
                        "isolate_alignments": isolate,
                        "subtraction_alignments": subtraction,
                        "input_fastq": fastq,
                        "proc": proc,
                    },
                    "result": {"subtracted": subtracted},
                    "output_fastq_sha256": sha256(out_fastq),
                    "output_alignments_sha256": sha256(out_alignments),
                }
            )

            print(f"  {name}: subtracted {subtracted}")

    return vectors


def build_candidate_vectors() -> list[dict]:
    if shutil.which("bowtie2-build") is None or shutil.which("bowtie2") is None:
        sys.exit("bowtie2 and bowtie2-build must be on PATH to generate candidates")

    vectors = []

    for name, reference, reads, proc, cutoff in CANDIDATE_CASES:
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "reference"

            subprocess.run(
                ["bowtie2-build", str(FIXTURES / reference), str(index)],
                check=True,
                capture_output=True,
            )

            found = find_candidate_otus_with_bowtie2(
                str(index),
                [str(FIXTURES / reads)],
                proc,
                cutoff,
            )

            vectors.append(
                {
                    "name": name,
                    "subcommand": "candidates",
                    "args": {
                        "reference": reference,
                        "reads": reads,
                        "proc": proc,
                        "p_score_cutoff": cutoff,
                    },
                    "result": sorted(found),
                }
            )

            print(f"  {name}: {sorted(found)}")

    return vectors


def main() -> None:
    write_candidate_fixtures()
    write_read_fastq(
        FIXTURES / "test_isolates_minimal.sam",
        FIXTURES / "subtraction_minimal_reads.fq",
    )
    write_read_fastq(
        FIXTURES / "to_subtraction.sam",
        FIXTURES / "to_subtraction_reads.fq",
    )

    print("em:")
    em = build_em_vectors()

    print("eliminate-subtraction:")
    subtraction = build_subtraction_vectors()

    print("candidates:")
    candidates = build_candidate_vectors()

    corpus = {
        "note": (
            "Captured from the PyO3 build of workflow-pathoscope before the crate "
            "moved to packages/pathoscope-core. Behaviour is pinned bug-for-bug, "
            "including the open question recorded in the coverage.rs TODO."
        ),
        "vectors": em + subtraction + candidates,
    }

    out = HERE / "vectors.json"
    out.write_text(json.dumps(corpus, indent=2, sort_keys=True) + "\n")

    print(f"\nwrote {len(corpus['vectors'])} vectors to {out}")


if __name__ == "__main__":
    main()
