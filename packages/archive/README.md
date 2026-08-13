# @virtool/archive

Tar and gzip, for anything in the monorepo that reads or writes an archive.

Framework-agnostic and dependency-light: `tar-stream` plus `node:zlib`, no
database, no object storage, no logger. It is imported by `@virtool/workflow`
(cache archives), by the workflow apps (gzipping reads and assemblies), and by
`@virtool/tasks` (the HMM release archive).

## Exports

| Subpath | Exports |
| --- | --- |
| `@virtool/archive` | everything below |
| `@virtool/archive/tar` | `extractTarToDir`, `extractTarMembers`, `writePathAsTar` |
| `@virtool/archive/compression` | `compressFile`, `decompressFile`, `isGzipped` |
| `@virtool/archive/errors` | `ArchiveError`, `TarArchiveError`, `TarMemberMissingError`, `TarTargetExistsError` |

Prefer a subpath. `@virtool/workflow` re-exports none of these any more —
consumers import them from here directly, so the definition site stays
greppable.

## Which tar function

`extractTarToDir` restores a whole tree and enforces the **cache archive
contract**: exactly one top-level entry, staged and renamed so a failure leaves
nothing behind, and the target must be free. It is what Python's `tarfile` on
the other side of the cache boundary expects, and `writePathAsTar` is its
inverse. Both are uncompressed-only, matching Python's `mode="w"`.

`extractTarMembers` pulls **named members** out of an archive whose other
contents do not matter, to destinations the caller chooses. It takes `gzip:
true` for a `.tar.gz`. Use it when you want two files out of a release archive,
not when you want a directory back.

## Two rules the extractors carry so callers cannot get them wrong

**Every entry is drained.** `tar-stream` will not advance past an entry that is
neither piped nor `resume()`d — it stalls silently and forever, no error, no
exit. Both loops resume what they skip, and both have a regression test that
asserts completion under a timeout rather than asserting an error.

**Every entry is validated, wanted or not.** Absolute paths, `..` segments and
anything that is not a plain file or directory fail the extraction. A guard that
only looks at what the caller asked for never looks at the payload.

## Divergences from Python

`extractTarToDir` stages and renames rather than pre-validating with
`getmembers()`, which would mean reading a multi-gigabyte archive twice on a
stream parser. Links and device nodes are refused outright, where
`filter="data"` admits a symlink that stays inside the destination.

`compressFile` drops the `pigz` branch: checksums are taken over decompressed
content, so the gzip bytes need not match Python's.

## Testing

`vitest run` from this directory, or `pnpm test` from the root. No containers
and no fixtures checked into the repo — archives are built in-test with
`tar-stream`'s `pack`.
