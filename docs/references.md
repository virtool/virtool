# References

## Local v2 curation

Reference v2 lives alongside v1. It does not convert v1 references, indexes,
or history. Set `VT_REFERENCE_V2_BETA=1` to show the v2 pages and enable their
FASTA downloads; v1 remains available when the flag is off. Reference
membership grants read access, while `modify` and `modifyOtu` rights control
reference and OTU changes. Archived references stay readable but cannot be
edited. The beta flag hides pages and downloads; server mutations still enforce
their normal rights and archived-state rules.

A curator creates a local OTU from manually entered sequences or previews NCBI
accessions before confirming. NCBI records are resolved again at save time.
Local maintenance ownership is independent of taxonomy and sequence origin, so
one OTU may contain manual and GenBank isolates. Each sequence records `manual`
or `genbank` source and an exact accession version for GenBank bases. Editing
those bases changes the source to manual and clears the accession. The OTU plan
holds segment names, required or recommended rules, lengths, and tolerances.
Every surviving isolate is checked against a proposed plan or sequence edit;
missing recommended isolate/segment pairs require explicit acknowledgement.

Excluding an accession base retires any isolate that uses it and blocks future
imports. Allowing the base lifts that block without restoring isolates. A
RefSeq replacement or newer accession version needs an NCBI preview and
curator approval before promotion or refresh. Superseded bases cannot be
reimported. Versioned commands and semantic history record these decisions
without exposing sequence bodies in overview reads.

Current Reference, OTU, and isolate FASTA exports need no published version.
Each header includes stable Reference, OTU, isolate, sequence, and segment IDs,
then `source=manual` or `source=genbank` and its exact `accession` version.
Exports include current, non-deleted locally maintained OTUs and stream sequence
bodies in bounded pages. An empty Reference yields an empty FASTA file.

## Indexes

## SQLite artifact

A reference index is stored as one gzip-encoded SQLite file. A workflow
stream-decompresses it to a transient raw SQLite path before `packages/sqlite/`
opens it.

Three names, one SQLite format:

| Name | Written by | Holds |
| --- | --- | --- |
| `reference-snapshot.v1.sqlite.gz` | a finished index build, in storage | a whole reference |
| `reference-snapshot.v1.sqlite` | a build or workflow, transiently | the raw SQLite prerequisite/working file |
| `index.v1.sqlite` | a workflow, locally | whatever survived a step |

The names are deliberately distinct. Pathoscope's collapsed reference is missing
every isolate `cd-hit-est` dropped, and one name for both is how a partial
artifact ends up uploaded as a whole reference. Both carry
`format = virtool-reference-sqlite` and `format_version = 1` in their `metadata`
table, which `openIndexArtifact` checks before a run reads a row.

### Measurements

When measured on a synthetic 300 MB artifact containing 20,000 OTUs and 60,000
sequences of 5 kb, scanning the whole index to a 287 MB FASTA didn't increase
peak RSS: it was 87 MB before and after. Using `.all()` on any query in
`queries.ts` undoes that.

The bulk-load transaction (`createIndexArtifact` in `create.ts`), same
artifact, same machine:

| Path | Time |
| --- | --- |
| Raw prepared statements, one transaction | **0.5 s** |
| Raw prepared statements, autocommit | ~146 s (projected from 2,000 OTUs) |

Outside a transaction SQLite commits per statement, which is one fsync per
sequence row. Reads on the same artifact: 1.4 s to write the full FASTA and
0.6 s to scan every OTU document.
