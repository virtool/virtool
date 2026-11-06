---
virtool: minor
create-sample: minor
---

Support bzip2 compressed FASTQ uploads

Upload `.fastq.bz2` and `.fq.bz2` files to create samples. Virtool converts the files to gzip during sample creation. Sample jobs now show a **Normalize reads** step.

**Action required:** Deploy the new Create Sample image before or with the web image. An older image can't read bzip2 uploads.
