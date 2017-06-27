GenBank
=======

Get
---

Get a Virtool-style sequence document for the given accession. The data is retrieved from GenBank and converted into a
palatable format.

::

    GET /api/genbank/:accession


**Response**

.. code-block:: javascript

    Status: 200 OK

    {
        "accession": "KJ406323",
        "sequence": "ATGTCTTACAGTATCACTACTCCATCTCAGTTCGTGTTCTTGTCATCAGCGZ...",
        "host": "Solanum lycopersicum",
        "definition": "Tobacco mosaic virus isolate TMV-tNK coat protein..."
    }