"""Generate ``findOrfs.json`` by running Python's ``find_orfs``.

This is the provenance record for that golden, in the same spirit as
``packages/workflow/src/index/fixtures/generate.py``. The file it writes is the
*reference* output, so regenerate it only to add cases — never to make a failing
comparison pass. ``pos`` is stored positionally in every NuVs analysis
``results`` blob, so a divergence is a divergence in data already written.

Run it against a checkout or virtualenv that has ``virtool`` importable::

    PYTHONPATH=<virtool site-packages> python3 \
        packages/bio/src/fixtures/generateFindOrfs.py \
        > packages/bio/src/fixtures/findOrfs.json

The seed is fixed, so the random cases are reproducible.
"""

import json
import random
import sys

from virtool.bio import find_orfs

random.seed(2852)


def random_seq(n, weights=None):
    bases = "ACGT"
    if weights:
        return "".join(random.choices(bases, weights=weights, k=n))
    return "".join(random.choice(bases) for _ in range(n))


cases = []


def add(name, sequence):
    cases.append(
        {
            "name": name,
            "sequence": sequence,
            "orfs": [
                {
                    "pro": o["pro"],
                    "nuc": o["nuc"],
                    "frame": o["frame"],
                    "strand": o["strand"],
                    "pos": list(o["pos"]),
                }
                for o in find_orfs(sequence)
            ],
        },
    )


# The length gate is `> 300`, not `>= 300`.
add("exactly 300 bp", random_seq(300))
add("301 bp", random_seq(301))
add("under 300 bp", random_seq(299))

# No stop codons at all, at three lengths. Every frame is one long ORF, the
# forward end clamps to the sequence length, and the reverse start goes negative
# because it subtracts three without clamping. The three lengths differ in the
# trailing remainder, which is what decides how negative.
add("no stops, 450 bp", "AAA" * 150)
add("no stops, 449 bp", "AAA" * 149 + "AA")
add("no stops, 448 bp", "AAA" * 149 + "A")

# Stop-rich: nothing survives the 100-residue minimum.
add("stops in every frame", "TAAT" * 80)

# A clean ORF flanked by stops, so the frame-0 end does not clamp.
add("orf between stops", "TAA" + "AAG" * 120 + "TGA" + "CCC" * 20)

# Random sequences, where the quirks show up incidentally rather than by
# construction.
for n in (320, 512, 777, 1000, 1500, 2048):
    add(f"random {n} bp", random_seq(n))

# AT-rich makes stops frequent; GC-rich makes them rare.
add("at rich 900 bp", random_seq(900, weights=[35, 15, 15, 35]))
add("gc rich 900 bp", random_seq(900, weights=[15, 35, 35, 15]))

# Lower case and ambiguity codes, which `translate` maps to X.
add("lower case 600 bp", random_seq(600).lower())
add("with N runs", random_seq(400) + "N" * 30 + random_seq(400))

total = sum(len(c["orfs"]) for c in cases)
sys.stderr.write(f"{len(cases)} cases, {total} orfs\n")

print(json.dumps({"cases": cases}, indent="\t", ensure_ascii=True))
