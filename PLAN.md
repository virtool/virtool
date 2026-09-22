# Reference v2 completion plan

This plan closes the unfinished reference-curation capabilities in
[REVIEW.md](REVIEW.md). The struck-through review findings are complete. V1 and
v2 coexist: V1 history can be corrupt or incompatible with v2 types, so this
work does not convert V1 references, indexes, or history into v2.

The PR boundary is **all reference features below**, with v2 hidden behind an
app beta toggle. Publishing follows in the Reference Overhaul project. Analysis
integration follows publishing in the Analysis V2 project.

## Phase 1 — Complete OTU creation

- Give initial NCBI OTU creation the same resolve → preview → confirm flow as
  adding an isolate. Invalidate the preview when accession inputs change;
  re-resolve and validate records at save time.
- Support manual multipartite OTU creation. Curators define named segments,
  rules, expected lengths, and tolerances, then assign one sequence per segment
  in the first isolate. Use the same plan validation as NCBI-derived data.
- Keep maintenance ownership separate from taxonomy and sequence provenance so
  a locally maintained OTU can contain manual and NCBI-derived isolates.

**Exit:** Both creation paths produce complete, valid OTUs, and curators review
NCBI-derived data before it is saved.

## Phase 2 — Edit references and OTUs

- Add editing for reference name, description, and default segment tolerance.
- Add versioned commands and UI for editing taxonomy identity and lineage,
  molecule and plan, isolate metadata, and sequence metadata or bases. Keep
  sequence source and exact accession provenance explicit after each edit.
- Apply optimistic version checks, reference rights, and archived-state rules
  to every mutation. Validate every surviving isolate against a proposed plan
  or sequence change inside the transaction, and show affected isolates before
  a curator confirms it. Reject changes that would leave an invalid OTU.
- Record semantic history without sending sequence bodies in overview reads.

**Exit:** Curators can maintain manual and NCBI-derived local OTUs, including
multipartite OTUs, through the UI. Tests cover invalid edits, provenance,
permissions, and version conflicts.

## Phase 3 — Curate accessions and recommended segments

- Model excluded and promoted accession bases separately from active sequence
  provenance. Define how exclusion affects existing isolates, future imports,
  and the last-isolate invariant; expose exclude and allow actions in history.
- Detect RefSeq replacements and newer accession versions through
  `@virtool/ncbi`. Show the proposed taxonomy, segment, length, and sequence
  differences. A curator must approve each promotion or refresh before it
  changes the OTU. Replace a multipartite isolate consistently and prevent
  re-import of superseded accession bases.
- Show missing recommended segments during creation or editing and persist an
  explicit acknowledgement with the command. Required segments remain
  mandatory. Recheck all rules at save time.
- Handle NCBI changes between preview and save and make repeated curation
  attempts safe. Test duplicate, excluded, promoted, stale, ambiguous, and
  partial-replacement cases.

**Exit:** Curators can explain why an accession is excluded or replaced and
can knowingly accept a missing recommended segment. Every resulting OTU is
valid and auditable.

## Phase 4 — Export and beta PR

- Stream FASTA exports for the current v2 reference, OTU, and isolate state,
  with stable headers that identify their source. Enforce reference read
  rights. Exporting the current state does not require a published version.
- Hide v2 navigation and routes behind the app beta toggle while keeping V1
  fully operational. Keep v2 mutations protected by normal server rights and
  archived-state checks.
- Exercise the full reference path in UI and server tests: create manual and
  NCBI OTUs, edit them, curate accessions, acknowledge a recommended segment,
  and export sequences. Update the reference documentation and open the PR
  after all reference features above are in place.

**Exit — PR boundary:** Reference v2 has complete authoring, curation, and
sequence export behind the beta toggle. V1 references continue to work.

## Delivery rules

- Land schema, contract, data, server, UI, and documentation changes together
  for each vertical slice. Use data migrations where schema correctness depends
  on existing rows.
- Check each phase with focused data, server, and UI tests. Before committing,
  run `pnpm check`, `pnpm typecheck`, and `pnpm knip`.
