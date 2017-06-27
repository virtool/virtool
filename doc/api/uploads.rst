.. _uploads:

Uploads
=======

When uploads are required in Virtool, they should be targeted at ``/upload``. The available endpoints are:

+-------------------------------------------------+-------------------------+
| Situation                                       | Endpoint                |
+=================================================+=========================+
| Upload and import a Virtool viruses export file | /upload/viruses         |
+-------------------------------------------------+-------------------------+
| Upload a Illumina read file                     | /upload/reads           |
+-------------------------------------------------+-------------------------+
| Upload a .hmm file for use with NuVs            | /upload/hmm/profiles    |
+-------------------------------------------------+-------------------------+
| Upload and import a NuVs annotation file        | /upload/hmm/annotations |
+-------------------------------------------------+-------------------------+
| Upload a host FASTA file                        | /upload/host            |
+-------------------------------------------------+-------------------------+

