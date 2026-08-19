# `@virtool/bio`

Sequence utilities (complement, translation, ORF finding, FASTA/FASTQ) and the
pure text parsers the workflows need: `hmmscan --tblout`
(`@virtool/bio/hmmer`) and paired-end quality averaging
(`@virtool/bio/fastqc`) — `compositeQuality`, which `apps/create-sample` uses
to reduce two `packages/quality-core` reports into the one blob a sample
stores, and `roundHalfEven`, the half-to-even rounding both that averaging and
`quality-core` are specified to use.

Nothing here touches the filesystem, the network, or the database. Callers read
the bytes and hand over text — walking a results directory, or joining an HMM
hit to its annotation, belongs to the workflow that does the IO.

## Byte-identity with the stored data is the governing constraint

Virtool runs in certified lab settings. A parser that produces *equivalent but
differently rounded* output is a failure, not a nit. Analysis documents already
written sit in the same table as the ones written today and are rendered by the
same UI.

So the rule for everything in this package is: **match the stored and golden
output exactly, including its bugs.** `roundHalfEven` exists because
`Math.round` rounds half away from zero rather than half to even;
`parseHmmerTblout` reads the best-domain score and bias from each other's
columns; `findOrfs` emits a negative coordinate. None of those are defects to
be tidied up.

Do not "fix" a quirk in this package alone. A fix means a coordinated change to
the stored documents and to the UI — and until both move, a correction here is
a silent disagreement with every record written so far.

Where a divergence is deliberate it is commented at the site and pinned by a
test.

## Expected values come from the goldens

Tests here write their expectations out rather than capturing them from a
fixture, so a diff shows the number that changed. Those numbers are what the
frozen goldens hold and what is already stored in analysis documents. The
goldens are frozen references: **never edit one to make a failing comparison
pass.**

Treat a failure as a finding, not as a test to re-baseline.
