# Object storage

Virtool stores uploads, sample reads, analysis results, indexes, subtraction
files, HMM profiles, and caches in one S3 bucket or Azure Blob container.

The database records the complete key of each object. Keys have different
shapes, because migrated objects keep the keys they already had. Don't rename or
move objects in storage.

Virtool deletes an object when it deletes the row that records the key. If that
delete fails, Virtool logs the failure and the object stays in storage. Virtool
doesn't sweep storage for objects that no row records.

## Configuration

Each service that uses object storage reads these variables at startup. There is
no filesystem backend.

| Variable                          | Backend | Requirement                                         |
| --------------------------------- | ------- | --------------------------------------------------- |
| `VT_STORAGE_BACKEND`              | Both    | Required. Must be `s3` or `azure`.                  |
| `VT_STORAGE_S3_BUCKET`            | S3      | Required                                            |
| `VT_STORAGE_S3_REGION`            | S3      | Optional                                            |
| `VT_STORAGE_S3_ENDPOINT`          | S3      | Optional; omit for AWS. Uses path-style addressing. |
| `VT_STORAGE_S3_ACCESS_KEY_ID`     | S3      | Optional as a credential pair                       |
| `VT_STORAGE_S3_SECRET_ACCESS_KEY` | S3      | Optional as a credential pair                       |
| `VT_STORAGE_AZURE_ACCOUNT`        | Azure   | Required                                            |
| `VT_STORAGE_AZURE_CONTAINER`      | Azure   | Required                                            |
| `VT_STORAGE_AZURE_ACCESS_KEY`     | Azure   | Optional; managed identity if unset                 |
| `VT_STORAGE_AZURE_ENDPOINT`       | Azure   | Optional                                            |

Every variable accepts a `_FILE` variant. See
[the environment guide](env.md). An empty value counts as unset.
Supply the S3 access key and secret key together, or supply neither to use the
AWS credential chain.
