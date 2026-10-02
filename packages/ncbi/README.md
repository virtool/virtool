# `@virtool/ncbi`

A client for NCBI Nucleotide and NCBI Taxonomy.

The models project responses into Virtool's established record shapes; this
isn't a general GBSeq parser.

## Surface

```ts
import { createNcbiClient } from "@virtool/ncbi/client";

const client = createNcbiClient({ apiKey, logger });

await client.fetchGenbankRecord("NC_005954.1");
await client.fetchGenbankRecords(["NC_005954.1", "AF395128.1"]);
await client.fetchTaxonomyRecord(12242);
await client.fetchDescendantTaxids(3432891);
await client.fetchAccessionsByTaxid(12242, { refSeqOnly: true });
```

The parsers are exported separately from the client, so a caller holding a
response already can project it without making a request:

```ts
import { parseGenbankSet, parseTaxaSet } from "@virtool/ncbi";
```

## Why E-utilities

Four call shapes cover everything:

| Call | Response |
| -- | -- |
| `esearch(nuccore, idtype=acc)` | JSON |
| `esearch(taxonomy, txid[Subtree])` | JSON |
| `efetch(taxonomy, id=taxid)` | TaxaSet XML |
| `efetch(nuccore, rettype=gb, retmode=xml)` | GBSet XML |

ESearch supports `retmode=json` and EFetch doesn't, for any database, so two
of the four are typed JSON fetches.

**NCBI's Datasets v2 API isn't used for taxonomy.** It's still `v2alpha` and
requires two calls:
`taxonomy/taxon/{id}/dataset_report` for the ranked lineage and
`.../name_report` for acronyms and synonyms. Together they cover what one
`efetch(taxonomy)` returns in a single response. The API also has no
subtree search at all, only a taxon's direct `children`, which would turn one
request into a recursive walk.

**EMBL-EBI's ENA isn't used either.** The RefSeq gap is real and was measured
rather than assumed: `ena/browser/api/embl/NC_005954.1` answers `400 Unknown
accession format`, while INSDC accessions such as `AF395128.1` and `MN908947.3`
answer `200`. RefSeq is NCBI-curated and outside INSDC, and Virtool's
RefSeq-first isolate rules depend on it, so ENA can't be a replacement. It
remains available as a cross-check or fallback for INSDC records if NCBI
rate-limiting ever makes that worth building.

## NCBI's irregularities

NCBI responses require explicit handling for the following cases:

- **Errors returned with HTTP 200.** An ESearch refusal arrives as
  `{"esearchresult": {"ERROR": "..."}}` with a 200 status. It's detected
  before the result schema, which would otherwise default the absent `count`
  and `idlist` and report a refusal as a search that legitimately matched
  nothing. A term that matched nothing is a different thing: a real envelope
  with an `errorlist`. It's read as an empty result.
- **Every JSON scalar is quoted.** `count` arrives as `"872"`, so it's coerced
  before any paging arithmetic.
- **A repeated XML element has no stable shape.** One `<Acronym>` parses to a
  string and two parse to an array, so every repeated element goes through
  `toArray`. XML tag values are never auto-coerced (`parseTagValue: false`),
  which keeps an all-digit sequence a string and puts the integer-versus-string
  decision in the models rather than the parser.
- **Qualifiers written bare are flags.** `/proviral` has a name and no value,
  and becomes `true`.
- **A batch fetch can return fewer records than requested.** NCBI sends what it has
  and says nothing about the rest.
- **An unknown accession isn't a 404.** NCBI answers with HTTP 200 and an
  empty `GBSet` that contains an error string.

## Rate limiting

Requests share process-wide queues by transport and credential tier, including
when a client is created for every server request. Each queue spaces requests
within NCBI's limits: three per second anonymously or ten with an API key. This
avoids bursts that NCBI would reject while counting them against the same limit.

A request already cancelled when it reaches the front of the queue rejects
without consuming a pacing slot, so it cannot delay the live requests behind
it. The 30-second request timeout starts when a request leaves the queue, so
time spent waiting behind other requests does not count against it.

`fetchDescendantTaxids` is the one call that's not a fixed number of requests.
The subtree search is one, but NCBI sends no rank alongside the ids, so telling
subspecific taxa from the rest costs a taxonomy fetch per descendant. A species
with a dozen isolates takes seconds. This cost is inherent to the request.

`apiKey` is the instance's NCBI API key. An empty string means no key is
configured and `api_key` is left off the query string entirely. NCBI treats a
blank one as a bad key and refuses the request rather than falling back to the
anonymous tier.

The key is a credential. **The request URL never goes to a log or an error
message**, because the URL contains the key and nothing here removes it. The
caller reads the key from the `settings` row and gives it to
`createNcbiClient`, so this package has no dependency on settings. Publish only
whether a key is set, never the key.

A 429 or a 5xx is retried with exponential backoff; a 400 is a bad accession or
a malformed term and is returned to the caller, since no later attempt settles
it. A caller's `AbortSignal` escapes untranslated so a drain stops rather than
retrying.

## Single and batch fetches

Use `fetchGenbankRecord` for one accession and `fetchGenbankRecords` for a set.
They differ in what they do with a record that this client can't read: the
batch drops it, and the single fetch throws `NcbiUnreadableError`. The reason
for each is on the function.

## API boundaries

- **`rank` is a plain string.** Requiring an OTU to be at species rank or lower
  is a reference-building policy, not a property of an NCBI record. This client
  also checks arbitrary taxonomy IDs. `getSpecies()` returns `null` for a taxon
  at a rank higher than species rather than throwing.
- **No lineage domain objects.** `Lineage` and `Taxon` belong to reference
  building. Callers can assemble them from `fetchTaxonomyRecord` and
  `fetchDescendantTaxids`.
- **No on-disk cache.** Caching belongs to the caller because this package is
  used by a server, not a command-line tool.

## Testing

```
pnpm --filter @virtool/ncbi test
```

### Differential tests

`src/differential.test.ts` is the correctness bar. `src/fixtures/expected/`
holds validated models copied from [ref-builder](https://github.com/virtool/ref-builder);
`src/fixtures/genbank/` and
`src/fixtures/taxonomy/` hold the raw NCBI responses for the same 47
accessions and 11 taxonomy IDs. The test parses the responses and compares the
result with the expected model field by field.

The expected models don't contain raw XML. Recording the responses here puts
the XML-to-model step under test rather than only the model shape.

Refresh the recorded responses with:

```
pnpm --filter @virtool/ncbi refresh-fixtures
```

That rewrites only the responses, never `expected/`. Regenerating the expected
models from this client's own output would make the test compare the client to
itself, so a shape change at NCBI shows up as a failing test with a reviewable
diff. When a failure turns out to be NCBI having changed the *data* rather than
this client having broken, edit the expected file by hand and say so in the
commit. This was done for the realm `Monodnaviria` being renamed `Floreoviria`
(taxonomy ID 2731342) and for `unclassified Tolucaviricetes` (taxonomy ID 2788833) being
retired from beet black scorch virus's lineage.

### Live smoke tests

`src/live.test.ts` runs against the real NCBI and is skipped unless
`VT_NCBI_LIVE=1`. It's excluded from CI, where NCBI being down or rate-limiting
the runner would fail a build for reasons unrelated to the change.

```
VT_NCBI_LIVE=1 pnpm --filter @virtool/ncbi test
```

Set `VT_NCBI_API_KEY` to use the higher rate limit. These assert the shape NCBI
still sends, not the values. A renamed taxon isn't a regression, but a moved
field is.

## Residual risk

The fixtures cover organisms that are already curated, so new submissions may
introduce untested GBSeq shapes. The live smoke tests and golden files surface
those changes as reviewable diffs rather than silent regressions.
