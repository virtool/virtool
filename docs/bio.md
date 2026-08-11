# `@virtool/bio`

Pure, framework-agnostic sequence and tool-output parsing. Nothing in this
package touches the filesystem, the network, or the database — callers read the
bytes and hand over text.

## Byte-identity with Python is the governing constraint

Virtool runs in certified lab settings. A ported workflow that produces
*equivalent but differently rounded* output is a failure, not a nit. Python
still runs these workflows in production, and analysis documents written by
either implementation sit in the same table and are rendered by the same UI.

So the rule for everything here is: **match Python's output exactly, including
its bugs.** Where a divergence is deliberate, it is commented at the call site
and pinned by a test. Do not "fix" a quirk in this package alone — a fix means a
coordinated change to Python, the stored documents, and the UI.

## FastQC — `@virtool/bio/fastqc`

```ts
parseFastqcData(text: string): Quality
compositeQuality(left: Quality, right: Quality): Quality
```

`Quality` comes from `@virtool/contracts`; this package does not redeclare it.

Python's `parse_fastqc` walks a directory looking for `fastqc_data.txt` in each
subdirectory, then returns the single result or composites the pair. That walk
is IO and stays in the workflow runtime — including the rule that any count
other than one or two is an error. This package only parses one file's text and
averages two results.

### Rounding

Python's `round()` is round-half-to-even. JavaScript has no equivalent:
`Math.round` rounds half away from zero, and scaling by a power of ten first
(`Math.round(v * 1000) / 1000`) introduces error of its own — it disagrees with
Python on `2.675`, `12.345`, `0.05` and `0.15`, among others, because the stored
double sits fractionally off the decimal midpoint and there is no real tie to
break.

`roundHalfEven` therefore decomposes the double into `mantissa * 2 ** exponent`
and compares in exact integer arithmetic, which reproduces Python's result
because Python rounds the exact binary value too. Base qualities round to three
places and composition to one.

### `NaN` is a deliberate divergence

FastQC writes `NaN` in *Per base sequence content* when a base position has no
A, C, G or T at all. Its percentage denominator is the sum of those four counts
and `N` is not counted, so a cycle where every read is `N` divides zero by zero
and emits four NaNs at once.

Python intends to map that row to zeros — `_handle_nan_values` has the branch —
but the branch is unreachable. `float("NaN")` does not raise, so the row parses
successfully as `nan` and never reaches the fallback. Python emits `nan`.

This package emits **zeros** instead, treating the literal `NaN` as
unparseable. That is not a byte-identity violation, because Python's actual
output cannot be stored: `nan` is invalid JSON, Postgres JSONB rejects it, and
the `Quality` schema in `@virtool/contracts` rejects it too. There is no correct
existing output to match. Zero is also the honest reading — no A, C, G or T was
observed at that position.

A row with a *mixed* failure keeps Python's behaviour exactly: the first value
that parses replaces every value in the row, and a row where nothing parses
throws.

### Other behaviour worth knowing

- Sections open on `>>`, keyed by the text before the first tab, and close on
  `>>END_MODULE`. The pass/fail status is dropped.
- A binned base position such as `10-14` emits the same row once per position
  in the bin.
- Both matrix parsers track the last index and throw `Non-contiguous index`
  when one does not advance by exactly 1.
- Per-sequence quality is a fixed 50-element array; scores of 50 and above are
  ignored, and the count is truncated toward zero, not rounded.
- `compositeQuality` takes `length` as min/max over the **concatenation** of
  the two pairs, not element-wise, and truncates silently on a length mismatch
  because Python zips with `strict=False`.

## HMMER — `@virtool/bio/hmmer`

```ts
parseHmmerTblout(lines: Iterable<string>): HmmerHit[]
```

Only lines beginning with `vFam` are considered. That prefix test is the whole
filter — it is what skips every `#` comment line hmmscan writes.

**`best_bias` and `best_score` are swapped, on purpose.** hmmscan documents its
columns as target(0) accession(1) query(2) accession(3), full-sequence
E-value(4) score(5) bias(6), best-domain E-value(7) score(8) bias(9). Python
reads `best_bias` from column 8 (the score) and `best_score` from column 9 (the
bias). Every stored analysis document uses those names with those values, and
`NuvsOrfHit` in `@virtool/contracts` already declares them, so the port
reproduces the swap.

Joining a hit's cluster to its HMM annotation and merging into
`results.hits[sequenceIndex].orfs[orfIndex].hits` stays in the NuVs workflow —
both need the database. The parser returns a flat array carrying
`sequenceIndex` and `orfIndex`, in file order, so the runtime can group it.

**Three things fail loudly rather than producing a number.** A row with fewer
than ten fields, a target name that is not `vFam_<cluster>`, and a query name
that is not `sequence_<contig>.<orf>` each throw. Python raises an `IndexError`
on the first and an `AttributeError` on the other two, so none of them is a
behaviour this side invented — and the alternative is worse than a crash: those
two names are the *only* thing carrying a hit back to the ORF it belongs to, so
a `NaN` index would silently address the wrong ORF, or none, and be stored that
way.

## `findOrfs`

A transliteration of Python's `find_orfs`, quirks included, because `pos` is
stored positionally in the NuVs analysis document and rendered by the UI.

Two quirks are visible in the output, and both appear only when an ORF runs to
the end of the sequence without a stop codon:

- The forward-strand `end` adds the stop codon's three bases unconditionally
  and then clamps to the sequence length, so it reports the sequence length
  rather than the end of the last full codon.
- The reverse-strand `start` subtracts three unconditionally and is never
  clamped, so it reports a **negative** coordinate — `-3`, `-2` or `-1`,
  depending on the trailing remainder.

A third quirk affects `nuc` on every reverse-strand ORF, not just these: `pos`
is a correct pair of forward coordinates, but Python slices `nuc` out of the
reverse complement using them, so the window is offset by three bases. A
negative start makes the slice wrap to the end of the string. The NuVs workflow
pops `nuc` before the ORFs reach the stored document, so nothing observes it —
it is reproduced for completeness, using Python's slice semantics.

The gates: sequences of 300 bp or shorter yield nothing, and an ORF needs 100
residues. Both are exact — 300 yields nothing and 301 can yield ORFs; 99
residues is dropped and 100 is kept. ORFs come out in discovery order, strand
`[+1, -1]` outer and frame `0..2` inner, and that order is part of the stored
output because the workflow indexes them positionally.

### What the tests pin

Every quirk above is pinned by an explicit assertion in `src/bio.test.ts`,
with the expected values written out rather than captured from a fixture. The
coverage is: both gates at their boundaries (299/300/301 bp and 99/100/101
residues), each trailing remainder paired with the negative reverse-strand
start it produces, the offset reverse-strand `nuc`, all six strand-by-frame
combinations and the order they come out in, ambiguous bases, and lowercase
input.

Those numbers are not arbitrary — they are what the reference implementation
returns, and a change that alters any of them alters output already stored in
analysis documents. Treat a failure there as a finding, not as a test to
re-baseline.

### The differential golden

`src/bio.test.ts` is hand-written, which is exactly what cannot catch a
transliteration that misread the original: it states what the port is *meant* to
do. `src/findOrfs.differential.test.ts` compares against output Python actually
produced, held in `src/fixtures/findOrfs.json` and generated by
`src/fixtures/generateFindOrfs.py` — the provenance record, in the same spirit
as `packages/workflow/src/index/fixtures/generate.py`.

The cases are chosen to hit the quirks rather than the happy path: the length
gate at 299/300/301, three stop-free sequences whose trailing remainders differ
so each negative reverse-strand start appears, a stop-saturated sequence that
yields nothing, an ORF flanked by stops so the forward end does not clamp,
random sequences at six lengths, AT- and GC-biased sequences, lowercase input
and a run of `N`. Every field is compared, `nuc` included.

One test in that file asserts the golden's own coverage — both strands, all
three frames, at least one clamped end and at least one negative start. Without
it a golden that had drifted to all-empty would pass every comparison while
comparing nothing.

**Never regenerate the golden to make a failing comparison pass.** Regenerate it
only to add cases. `pos` is stored positionally in every NuVs analysis `results`
blob, so a divergence here is a divergence in data already written.

## FASTA

```ts
parseFasta(content: string): Array<[string, string]>
parseFastaLines(lines: AsyncIterable<string> | Iterable<string>): AsyncGenerator<[string, string]>
```

Two entry points onto one parser: they share the per-line state machine, so the
rules about blank lines, `\r`, and a sequence line appearing before any header
are written once and cannot drift. `parseFasta` needs the file in memory and V8
caps a string at roughly a gigabyte, which is a limit a caller reading an
assembly it did not size itself cannot do anything about; `parseFastaLines`
yields as it goes, the way `parseFastq` does. The NuVs workflow reads SPAdes'
scaffolds through the streaming one for that reason.
