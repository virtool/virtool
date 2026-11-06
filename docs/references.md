# Indexes

Virtool stores a reference index as one gzip-encoded SQLite file. A workflow
decompresses it to a temporary raw SQLite file before it opens it.

| Name | Written by | Holds |
| --- | --- | --- |
| `reference-snapshot.v1.sqlite.gz` | a finished index build, in storage | a whole reference |
| `reference-snapshot.v1.sqlite` | a build or workflow, temporarily | the raw SQLite file |
| `index.v1.sqlite` | a workflow, locally | what remains after a workflow step |

Each file has `format = virtool-reference-sqlite` and `format_version = 1` in its
`metadata` table. Virtool refuses a file with other values before it reads a row.
