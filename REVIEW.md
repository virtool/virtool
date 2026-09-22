# Refs v2 review

I reviewed the branch, including the uncommitted changes, and compared it with
the local ref-builder source. **The biggest problems are inconsistent validation
and the inability to extend manually created OTUs.**

## Findings

1. **[P1] Invalid isolates can be committed, then break subsequent operations.**

   Adding an isolate doesn’t enforce required segments or sequence-length
   tolerance in the transaction. The GenBank matcher also bypasses length checks
   for named segments and single-segment plans. I reproduced a four-base sequence
   being saved against an eight-base, zero-tolerance plan. Deleting the original
   valid isolate then commits successfully but fails while assembling the
   response; subsequent full OTU reads fail too. Validate every isolate against
   the plan **before committing**.

   [data.ts:329](packages/data/src/otus-v2/data.ts#L329),
   [genbank.ts:84](apps/web/src/server/otus-v2/genbank.ts#L84)

2. **[P1] Manually created OTUs cannot acquire another isolate through the UI.**

   Manual creation supplies no lineage. Adding an isolate requires an NCBI species
   in that lineage, and the save endpoint rejects commands without GenBank
   provenance. There’s neither manual isolate entry nor a way to associate an
   existing manual OTU with NCBI taxonomy. Consequently, a manual OTU is
   effectively stuck with its initial isolate.

   [CreateLocalOtuForm.tsx:134](apps/web/src/otus-v2/components/CreateLocalOtuForm.tsx#L134),
   [genbank.ts:72](apps/web/src/server/otus-v2/genbank.ts#L72),
   [functions.ts:243](apps/web/src/server/otus-v2/functions.ts#L243)

3. **[P1] Accessions from different isolates can silently become one biological isolate.**

   Validation compares taxid and organism, but never isolate/strain identity.
   Supplying segment 1 from isolate A and segment 2 from isolate B creates an
   isolate named A containing both. This affects initial OTU creation and
   additional isolates. Ref-builder explicitly rejects multiple isolate groups
   when constructing a plan.

   [genbank.ts:41](apps/web/src/server/otus-v2/genbank.ts#L41),
   [ref-builder plan.py:91](../ref-builder/ref_builder/plan.py#L91)

4. **[P2] Segment validation and matching fall short of ref-builder.**

   Multipartite plans accept unnamed or duplicate segment names. Initial creation
   also allows multiple sequences assigned to the same segment. Matching treats
   `RNA1`, `RNA 1`, and `1` as different identifiers; unnamed records use the first
   length-compatible segment, silently resolving ambiguous matches according to
   ordering. Ref-builder normalizes names and requires unique, named multipartite
   segments.

   [otusV2.ts:177](packages/contracts/src/otusV2.ts#L177),
   [genbank.ts:79](apps/web/src/server/otus-v2/genbank.ts#L79),
   [ref-builder plan.py](../ref-builder/ref_builder/plan.py)

5. **[P2] Re-importing an accession creates duplicate isolates.**

   Provenance validation checks the submitted records but never checks accessions
   already present in the OTU. Each submission receives fresh UUIDs, so importing
   the same accession again passes identity constraints. Although the latest
   changes preserve provenance in command history, current sequence records
   expose neither accession nor source. This also leaves no usable foundation
   for ref-builder’s accession deduplication, RefSeq promotion, and version
   updates.

   [functions.ts:255](apps/web/src/server/otus-v2/functions.ts#L255),
   [data.ts:357](packages/data/src/otus-v2/data.ts#L357)

6. ~~**[P2] Editing accession inputs leaves an old preview eligible for submission.**~~

   ~~Preview A remains visible and creatable after changing inputs to B, while B
   loads, and even if B fails. A user can therefore save A while the input shows
   B. Invalidate the preview when inputs change and disable creation until the
   current inputs have a successful preview.~~

   ~~[CreateLocalOtuIsolateDialog.tsx:61](apps/web/src/otus-v2/components/CreateLocalOtuIsolateDialog.tsx#L61)~~

7. ~~**[P2] Read-only users and archived references still show mutation controls.**~~

   ~~OTU/isolate Create and Delete controls don’t check reference rights or archived
   state. Users can complete a form or confirmation before receiving a refusal.
   The last isolate also offers deletion despite the invariant forbidding it.
   Server enforcement exists, but the UI should explain these restrictions before
   users attempt the operation.~~

   ~~[LocalOtuIsolates.tsx:43](apps/web/src/otus-v2/components/LocalOtuIsolates.tsx#L43),
   [DeleteLocalOtuIsolate.tsx:37](apps/web/src/otus-v2/components/DeleteLocalOtuIsolate.tsx#L37)~~

8. **[P2] Lazy sequence loading still transfers sequence bodies through history.**

   The overview selects every change’s complete payload, including sequence
   strings from creation events and deleted isolates. Opening an OTU therefore
   transfers its accumulated sequence history before any sequence is expanded.
   This will become expensive for large OTUs. Return history summaries separately
   from event bodies.

   [data.ts:666](packages/data/src/otus-v2/data.ts#L666)

## Unfinished capabilities

There are also substantial unfinished capabilities, distinct from the bugs above:

- Manual multipartite OTU creation; editing taxonomy, plans, isolates, or
  sequences; editing reference metadata/default tolerance.
- Ref-builder’s accession exclusion, RefSeq promotion, sequence refresh, and
  recommended-segment acknowledgement.
- Publishing/building usable reference versions and exporting sequences.
  Existing indexes still reference legacy references.
- Accession/source visibility on sequence details. Initial NCBI OTU creation
  also saves immediately, without the review step offered when adding an isolate.

## Manual and NCBI-derived data

The model needs to distinguish **who maintains an OTU** from **where its taxonomy
and sequences came from**. A locally maintained OTU should support both manual
and NCBI-derived isolates, with shared plan validation and explicit provenance
for each.

## Validation

40 of 41 selected existing tests passed; the failure expects an absolute
“Created YYYY-MM-DD” label where the UI now renders relative time. Seven
temporary reproductions confirmed the issues above, including the database
integrity failure. I removed those temporary tests and made no implementation
changes. This was a source/test review, not a live browser review.
