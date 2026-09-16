# @virtool/archive

Tar, gzip and zip, for anything in the monorepo that reads or writes an archive.

Framework-agnostic and dependency-light: `tar-stream` and `fflate` plus
`node:zlib`, no database, no object storage, no logger. It's imported by
`@virtool/workflow` (cache archives), by the workflow apps (reading gzip magic),
by `@virtool/internal`'s `run` subcommand (the HMM release archive) and by `@virtool/data` (the NCBI
BLAST result zip).

## Exports

| Subpath | Exports |
| --- | --- |
| `@virtool/archive` | everything below |
| `@virtool/archive/tar` | `extractTarToDir`, `extractTarMembers`, `writePathAsTar` |
| `@virtool/archive/zip` | `readZipMember` |
| `@virtool/archive/compression` | `compressFile`, `decompressFile`, `decompressGzipToFile`, `DecompressedSizeLimitError`, `isGzipped` |
| `@virtool/archive/errors` | `ArchiveError`, `TarArchiveError`, `TarMemberMissingError`, `TarTargetExistsError`, `ZipArchiveError`, `ZipMemberMissingError` |

Prefer a subpath. `@virtool/workflow` no longer re-exports any of these.
consumers import them from here directly, so the definition site stays
greppable.

## Which tar function

`extractTarToDir` restores a whole tree and enforces the **cache archive
contract**: exactly one top-level entry, staged, and renamed so a failure leaves
nothing behind, and the target must be free. `writePathAsTar` is its inverse.
Both are uncompressed-only.

`extractTarMembers` pulls **named members** out of an archive whose other
contents don't matter, to destinations the caller chooses. It takes `gzip:
true` for a `.tar.gz`. Use it when you want two files out of a release archive,
not when you want a directory back.

## Zip doesn't stream, and that's not a gap to fill

`readZipMember` takes the whole archive as a `Uint8Array` and returns one
member's bytes. It can't stream: a zip's index is a central directory written
at the *end* of the file, so nothing can name a member until the last byte has
arrived. That's acceptable for the one thing here that reads a zip: an NCBI
BLAST result that's only a handful of kilobytes. Anything a user
uploaded goes through tar, or nowhere.

## Two rules the extractors carry so callers can't get them wrong

**Every entry is drained.** `tar-stream` doesn't advance past an entry that's
neither piped nor `resume()`d. It stalls silently and forever, with no error or
exit. Both loops resume what they skip, and both have a regression test that
asserts completion under a timeout rather than asserting an error.

**Every entry is validated, wanted, or not.** Absolute paths, `..` segments and
anything that's not a plain file or directory fail the extraction. A guard that
only looks at what the caller asked for never looks at the payload.

`extractTarToDir` stages and renames rather than pre-validating the archive up
front, which on a stream parser would mean reading a multi-gigabyte file twice.
Links and device nodes are refused outright, symlinks included, even ones that
would stay inside the destination.

## Gzip

`compressFile` compresses in-process: checksums are taken over decompressed
content, so the gzip bytes need not be reproducible. Workflow steps gzip
gigabytes at a time and use `gzipFile` from `@virtool/workflow` instead, which
runs `pigz`.

`decompressGzipToFile` takes an `AsyncIterable<Uint8Array>` so object-storage
callers can inflate directly into a destination without buffering or retaining
a compressed copy. Its optional limit counts decompressed bytes and fails with
`DecompressedSizeLimitError`; its optional cancellation signal tears down the whole
pipeline.

## Testing

`vitest run` from this directory, or `pnpm test` from the root. The tests use no
containers, and no fixtures are checked into the repo. Archives are built in-test with
`tar-stream`'s `pack`.
