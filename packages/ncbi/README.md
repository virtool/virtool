# `@virtool/ncbi`

A client for NCBI Nucleotide and NCBI Taxonomy through the E-utilities API.
It projects responses into Virtool's record shapes. It is not a general GBSeq
parser.

- Import the client from `@virtool/ncbi/client`.
- Import the parsers, so you can project a response you already hold, from
  `@virtool/ncbi`.
- Import the accession helpers, error classes, and models from their own entry
  points.

## Configuration

`apiKey` is the instance's NCBI API key. An empty string means no key. With a
key, NCBI allows ten requests a second. Without one, it allows three. The
package paces requests to stay inside the limit.

The package never writes the API key, or a request URL, to a log or an error
message.

## Commands

Run from the monorepo root.

| Command                                           | Action                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm --filter @virtool/ncbi test`                | Run tests.                                                     |
| `pnpm --filter @virtool/ncbi typecheck`           | Type-check the package.                                        |
| `pnpm --filter @virtool/ncbi refresh-fixtures`    | Record NCBI responses again. Expected models stay as they are. |
| `VT_NCBI_LIVE=1 pnpm --filter @virtool/ncbi test` | Also run the smoke tests against the real NCBI.                |

CI does not run the live tests. Set `VT_NCBI_API_KEY` to use the higher rate
limit with them.
