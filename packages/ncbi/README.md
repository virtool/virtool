# `@virtool/ncbi`

A client for NCBI Nucleotide and NCBI Taxonomy.

It is a port of `ref_builder/ncbi/` from the [ref-builder](https://github.com/virtool/ref-builder)
project, which is the specification the projections here hit. The models are a
projection into a known shape, not a general GBSeq parser.

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

ESearch supports `retmode=json` and EFetch does not, for any database, so two
of the four are typed JSON fetches.

**NCBI's Datasets v2 API is not used for taxonomy.** It was evaluated and
rejected: it is still `v2alpha`, it takes two calls — `taxonomy/taxon/{id}/dataset_report`
for the ranked lineage and `.../name_report` for acronyms and synonyms — to
cover what one `efetch(taxonomy)` returns in a single response, and it has no
subtree search at all, only a taxon's direct `children`, which would turn one
request into a recursive walk.

**EMBL-EBI's ENA is not used either.** The RefSeq gap is real and was measured
rather than assumed: `ena/browser/api/embl/NC_005954.1` answers `400 Unknown
accession format`, while INSDC accessions such as `AF395128.1` and `MN908947.3`
answer `200`. RefSeq is NCBI-curated and outside INSDC, and Virtool's
RefSeq-first isolate rules depend on it, so ENA cannot be a replacement. It
remains available as a cross-check or fallback for INSDC records if NCBI
rate-limiting ever makes that worth building.

## NCBI's irregularities

These are handled deliberately, because Biopython's `Entrez.read()` — with its
DTD-driven coercion and years of accumulated special cases — is what this
client does without.

- **Errors returned with HTTP 200.** An ESearch refusal arrives as
  `{"esearchresult": {"ERROR": "..."}}` with a 200 status. It is detected
  before the result schema, which would otherwise default the absent `count`
  and `idlist` and report a refusal as a search that legitimately matched
  nothing. A term that matched nothing is a different thing — a real envelope
  with an `errorlist` — and is read as an empty result.
- **Every JSON scalar is quoted.** `count` arrives as `"872"`, so it is coerced
  before any paging arithmetic.
- **A repeated XML element has no stable shape.** One `<Acronym>` parses to a
  string and two parse to an array, so every repeated element goes through
  `toArray`. XML tag values are never auto-coerced (`parseTagValue: false`),
  which keeps an all-digit sequence a string and puts the integer-versus-string
  decision in the models rather than the parser.
- **Qualifiers written bare are flags.** `/proviral` has a name and no value,
  and becomes `true`.
- **A fetch of many accessions can answer with fewer.** NCBI sends what it has
  and says nothing about the rest.
- **An unknown accession is not a 404.** NCBI answers with HTTP 200 and an
  empty `GBSet` that contains an error string.

## Rate limiting

Requests are serialised through a queue that holds each one back until the rate
NCBI allows has elapsed since the last: three requests a second anonymously,
ten with an API key. A queue rather than a token bucket, because a burst is
paid for with a refusal that costs another request against the same limit.

`fetchDescendantTaxids` is the one call that is not a fixed number of requests.
The subtree search is one, but NCBI sends no rank alongside the ids, so telling
subspecific taxa from the rest costs a taxonomy fetch per descendant. A species
with a dozen isolates takes seconds. ref-builder pays the same cost; it is
inherent to the question, not to this implementation.

`apiKey` is the instance's NCBI API key. An empty string means no key is
configured and `api_key` is left off the query string entirely — NCBI treats a
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

## One record or many

Use `fetchGenbankRecord` for one accession and `fetchGenbankRecords` for a set.
They differ in what they do with a record that this client cannot read: the
batch drops it, and the single fetch throws `NcbiUnreadableError`. The reason
for each is on the function.

## Divergences from ref-builder

- **`rank` is a plain string.** ref-builder rejects any taxon above species at
  validation time, because an OTU must be species-or-below. That is a
  reference-building policy, not a property of the record, and this client is
  also used to validate an arbitrary taxid a user has typed. `getSpecies()`
  returns `null` for a taxon above species rather than throwing.
- **No `fetch_lineage`.** It assembles ref-builder's own `Lineage` and `Taxon`
  domain objects, which belong to reference building rather than to an NCBI
  client. The pieces it is built from — `fetchTaxonomyRecord` and
  `fetchDescendantTaxids` — are both here.
- **No on-disk cache.** `NCBICache` writes to a user cache directory, which
  suits a CLI and not a server. Caching belongs to the caller.

## Testing

```
pnpm --filter @virtool/ncbi test
```

### Differential tests

`src/differential.test.ts` is the correctness bar. `src/fixtures/expected/`
holds ref-builder's own validated models, copied from its
`tests/fixtures/ncbi/otus/`; `src/fixtures/genbank/` and
`src/fixtures/taxonomy/` hold the raw NCBI responses for the same 47
accessions and 11 taxids. The test parses the responses and asserts the result
equals ref-builder's model, field for field.

**ref-builder records no raw XML of its own** — everything it keeps is already
past `Entrez.read()` — so recording the responses here is what puts the
XML-to-model step under test rather than only the model step.

Refresh the recorded responses with:

```
pnpm --filter @virtool/ncbi refresh-fixtures
```

That rewrites only the responses, never `expected/`. Regenerating the expected
models from this client's own output would make the test compare the client to
itself, so a shape change at NCBI shows up as a failing test with a reviewable
diff. When a failure turns out to be NCBI having changed the *data* rather than
this client having broken, edit the expected file by hand and say so in the
commit — as was done for the realm `Monodnaviria` being renamed `Floreoviria`
(taxid 2731342) and for `unclassified Tolucaviricetes` (taxid 2788833) being
retired from beet black scorch virus's lineage.

### Live smoke tests

`src/live.test.ts` runs against the real NCBI and is skipped unless
`VT_NCBI_LIVE=1`. It is excluded from CI, where NCBI being down or rate-limiting
the runner would fail a build for reasons unrelated to the change.

```
VT_NCBI_LIVE=1 pnpm --filter @virtool/ncbi test
```

Set `VT_NCBI_API_KEY` to use the higher rate limit. These assert the shape NCBI
still sends, not the values — a renamed taxon is not a regression, a moved
field is.

## Residual risk

The fixtures cover organisms that are already curated, so novel GBSeq shapes
from new submissions will still surprise. The live smoke tests and the
refreshable golden files are how that surfaces as a reviewable diff rather than
a silent regression.
