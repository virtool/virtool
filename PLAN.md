# Reference Overhaul implementation plan

## Purpose

Start Reference Overhaul with one tracer bullet that proves the central v2
architecture from the browser to Postgres without changing or routing traffic
away from the v1 reference stack.

The tracer bullet is complete when a permitted user can create a local v2
Reference, create one complete local OTU inside it, and reload a detail page
that was assembled from relational state. The OTU creation must commit its
first semantic history record atomically and reject invalid or stale input.

This plan is the implementation checkpoint for the project. Linear remains
read-only during this work: no issues are created initially.

## Why this slice

The riskiest project claim is not that another table or page can be added. It
is that an OTU can be valid by construction while relational current state,
immutable records, version ranges, and semantic history remain consistent in
one transaction. Starting with an incomplete OTU or a metadata-only row would
sidestep that claim and create a model the project explicitly forbids.

A local OTU avoids NCBI and ref-builder integration while exercising the same
aggregate boundary needed later. Requiring one plan, one isolate, and one
sequence proves the minimum useful biological model without introducing
follow-up mutation commands.

## Demonstrated user path

1. A user with `create_ref` creates a local v2 Reference.
2. The creator receives the existing three Reference rights in the same
   transaction.
3. From an explicit v2 route, the user submits one complete `CreateOTU`
   command containing:
   - a local display identity;
   - molecule metadata;
   - a monopartite plan with one unnamed segment;
   - one isolate; and
   - one normalized local sequence bound to that segment.
4. The server checks `modifyOtu`, Reference state, command schema version, and
   `expectedVersion = 0`.
5. One transaction validates the complete aggregate, writes version 1 state,
   writes exactly one `otu_changes` row, and commits.
6. The client navigates to the returned OTU UUID.
7. Reloading the page reads and assembles the aggregate from relational state,
   not from the command payload or history replay.
8. The page displays the local identity, molecule, plan, isolate, sequence,
   version, and creation-history summary.

## Slice boundary

### Included

- Parallel v2 Reference contracts, schema, persistence, authorization, create,
  and detail read.
- The shared subset of the v2 model needed by a complete local `CreateOTU`.
- An explicit local taxonomy variant and immutable local identity revision.
- Stable plan, segment, isolate, and logical sequence UUIDs.
- One immutable local sequence record and version-ranged bindings/state.
- Canonical command envelope version 1 for `CreateOTU`.
- Aggregate validation before persistence.
- Optimistic-version semantics, including rejection of an invalid non-zero
  create expectation.
- Exactly one semantic history row for the successful command.
- Parent-scoped visibility checks for reads and `modifyOtu` checks for writes.
- An isolated, authenticated `/refs-v2` client surface that does not replace or
  alter `/refs`.
- Focused data, server-function, and component/route tests.

### Deferred

- NCBI-backed OTUs, taxonomy fetching, accession registries, and taxon claims.
- Every command after `CreateOTU`, including edits, deletion, and
  local-to-NCBI conversion.
- Remote synchronization and ref-builder event decoding.
- Legacy copy, v1 export, dual writes, migration, or legacy retirement.
- Workflow, index, and analysis integration.
- Reference list search, pagination, groups UI, archiving UI, and full settings.
- File upload/object-storage integration. The first form accepts sequence text;
  upload parsing can later feed the same normalized command contract.
- SSE publication and a history viewer.
- Full DDL for deferred NCBI and command paths.

## Architecture and naming

Keep v2 parallel and explicit. Do not overload legacy contracts, JSONB-backed
tables, queries, cache keys, events, or routes with fake defaults.

Use `reference-v2` as the feature-directory suffix where coexistence would
otherwise be ambiguous. Use the clean table names settled in the Schema design
document (`reference_roots`, `otus`, `otu_changes`, and their child tables),
because the existing tables already carry `legacy_` names.

Likely module boundaries:

- `packages/contracts/src/referencesV2.ts`: v2 Reference wire shapes and create
  schema.
- `packages/contracts/src/otusV2.ts`: aggregate values, canonical `CreateOTU`
  command, validation schemas, and read shapes.
- `packages/data/src/db/schema/referencesV2.ts`: v2 Reference and membership
  tables.
- `packages/data/src/db/schema/otusV2.ts`: the local-creation subset of the
  settled relational schema.
- `packages/data/src/references-v2/data.ts`: Reference create/read and rights.
- `packages/data/src/otus-v2/data.ts`: transactional command application and
  aggregate assembly.
- `apps/web/src/server/references-v2/functions.ts` and
  `apps/web/src/server/otus-v2/functions.ts`: transport, authorization, and
  error mapping.
- `apps/web/src/references-v2/` and `apps/web/src/otus-v2/`: query keys, query
  hooks, and components.
- `apps/web/src/routes/_authenticated/refs-v2/`: isolated list/create,
  Reference detail, OTU create, and OTU detail routes.

Adjust names if implementation reveals a clearer repository convention, but
preserve the v1/v2 boundary. Add new contract and Drizzle schema exports to
their package barrels. Add web aliases to `apps/web/tsconfig.json` and the
corresponding server `noRestrictedImports` configuration.

## Implementation sequence

### 1. Freeze the tracer contracts and examples

- Translate only the required v2 value shapes and `CreateOTU` payload into
  Zod-backed TypeScript contracts.
- Use UUIDs supplied by the client for all creation identities.
- Define normalization for names, optional acronym, molecule values, sequence
  definition, and nucleotide body before persistence.
- Reject unknown command and payload fields.
- Add a small conformance fixture representing one valid monopartite local OTU
  plus invalid cases for an empty isolate, missing segment binding, wrong
  length/tolerance, duplicate UUID, empty sequence, and taxonomy/sequence-kind
  mismatch.
- Keep command payload and aggregate read shapes distinct so history storage
  cannot become the read model accidentally.

Exit condition: contracts parse the valid fixture and reject each invalid
fixture with an explicit assertion.

### 2. Add the minimum relational schema

Implement the settled schema subset required by the user path:

- `reference_roots`, `reference_users`, and `reference_groups`;
- `otus` and `otu_changes`;
- `otu_local_identities`, `otu_local_identity_revisions`, and
  `otu_taxonomy_versions`;
- `otu_plans`, `otu_plan_segments`, and `otu_plan_segment_versions`;
- stable isolate identities and their version rows;
- stable sequence identities, immutable local sequence records, and
  version-ranged sequence bindings.

Use named table-level foreign keys, composite ownership keys, positive/check
constraints, current-row indexes, and non-overlapping `[first_version,
last_version)` ranges where the settled schema requires them. Add the
deferrable current-root/history relationship and history-contiguity guard if
Drizzle cannot express them directly by generating the migration and then
adding only the required SQL to that generated migration.

Do not add placeholder NCBI columns or nullable hybrid states. Add future
tables only when a later slice can enforce their invariants.

Exit condition: a generated migration applies to an isolated test database,
and database tests prove ownership, range, history, and local-only shape
constraints.

### 3. Implement pure aggregate validation and assembly

- Build a framework-free validator that checks the complete local aggregate:
  exactly one current taxonomy assignment and plan, a non-empty isolate set,
  non-empty sequence sets, valid segment membership, segment rules and length
  tolerance, stable identity uniqueness, and local-only record provenance.
- Build current and historical aggregate assemblers from relational rows.
- Keep independent reads in `Promise.all` and validate the assembled result at
  the boundary.
- Never read `otu_changes.payload` to assemble state.

Exit condition: unit/integration tests show the persisted version-1 aggregate
round-trips exactly and can be assembled at version 1 without replay.

### 4. Implement atomic Reference and `CreateOTU` writes

- Create a local Reference and its creator membership in one transaction.
- Apply `CreateOTU` as one read-validate-write transaction.
- Require command schema version 1 and `expectedVersion = 0`.
- Insert all stable identities, immutable records, version-1 state, the OTU
  root, and exactly one history row atomically.
- Store the original canonical command name, schema version, and payload in
  history while returning the assembled read model.
- Map named database constraint failures to typed data errors.
- Prove rollback leaves no root, children, or history when any write or final
  validation fails.

Exit condition: concurrent duplicate creation and injected mid-transaction
failure tests preserve every invariant and never leave partial aggregates.

### 5. Expose an authorization-correct server boundary

- Add authenticated Reference and OTU create/read server functions.
- Reuse the existing permission vocabulary and additive user/group rights
  semantics, but query the v2 membership tables.
- Collapse missing and invisible resources to the same 404 response.
- Check rights before archived/remote state on writes so an unauthorized user
  cannot infer hidden Reference state.
- Return 201 for creates, 403 for insufficient rights, 404 for missing or
  invisible resources, 409 for archived/remote writes and command conflicts,
  and 400 for malformed commands.
- Add each new `functions.ts` module and its `?tss-serverfn-split` form to the
  authorization inventory test.

Exit condition: server-function tests cover signed-out, invisible, visible,
`modifyOtu`, administrator, malformed, conflict, and successful cases.

### 6. Add the isolated browser path

- Add an authenticated `/refs-v2` surface rather than introducing a new flag
  system or branching the legacy `/refs` loaders.
- Provide a minimal local Reference create form and detail page.
- Provide a complete local OTU form and detail page; generate all UUIDs before
  submission and navigate to the returned OTU after creation.
- Keep incomplete form state in the client only. The server receives one
  complete command.
- Use dedicated v2 query keys so invalidation cannot collide with legacy SSE or
  query behavior.
- Dynamically import query modules inside route loaders, keep rendering
  SSR-pure, and import server declarations only through `@server/*`.
- Label the surface Beta in the UI. Direct routing is the initial opt-in; a
  runtime capability/flag can be designed later if access needs tighter
  control.

Exit condition: a component/route test creates a complete OTU, observes
navigation to its UUID, and renders data returned by the detail read.

### 7. Review the seam before expanding

Walk the successful command through contracts, authorization, transaction,
tables, assembler, server response, query cache, and rendered page. Confirm:

- no v1 table, contract, route, query key, event, or downstream workflow was
  changed;
- history contains exactly what the command boundary accepted;
- current reads do not replay history;
- every persisted OTU is complete and valid;
- stable UUIDs are visibly preserved across every layer; and
- the schema can add later version rows and NCBI record variants without
  rewriting the version-1 local data.

Record any necessary schema correction in the project design documents before
starting `SetPlan`, `CreateIsolate`, or NCBI work. Continue by adding one command
at a time through the same seam.

## Acceptance criteria

- V1 Reference and OTU behavior and routes remain operational and unchanged.
- A permitted user can create and reload a local v2 Reference and one complete
  local OTU through the browser.
- The OTU has version 1 and exactly one `CreateOTU` history row committed in
  the same transaction.
- The read model is assembled solely from relational state.
- Invalid aggregates and malformed commands persist nothing.
- Unauthorized and invisible reads/writes have the expected 403/404 behavior.
- Archived or remote References cannot be mutated.
- A failed transaction cannot leave a partial OTU or orphaned immutable row.
- All new IDs, timestamps, discriminators, and command payloads cross the wire
  with their documented types.
- No Linear issue is created or modified as part of the tracer bullet.

## Verification

Run focused tests while building each layer, then the repository checks:

```text
pnpm --filter @virtool/data test
TZ=UTC pnpm --filter @virtool/web exec vitest run <affected server and UI tests>
pnpm --filter @virtool/web build
pnpm check
pnpm typecheck
pnpm knip
```

The route build must run before type-checking so
`apps/web/src/routeTree.gen.ts` is regenerated and included if it changes. The
full monorepo test suite is not required for this isolated slice unless its
implementation becomes cross-cutting.

## First implementation checkpoint

Stop after steps 1–4 and review the persistence seam before adding transport or
UI. At that checkpoint, a test must be able to create a v2 Reference, submit
one canonical local `CreateOTU`, commit version 1 plus one history row, and read
the same complete aggregate back from relational state. This is the smallest
checkpoint that actually tests the Reference Overhaul design.
