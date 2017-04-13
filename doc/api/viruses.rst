Viruses
=======

Manage viruses and their history.



Find
----

Find truncated viruses based on filters described in URL parameters. Documents are truncated.

::

    GET /api/viruses


**Response**

.. code-block:: javascript

    Status: 200 OK

    [
        {
            "virus_id": "cd5dbc59",
            "name": "Peach rosette mosaic virus",
            "abbreviation": "PRMV",
            "version": 0,
            "modified": false
        },
        {
            "virus_id": "e71be9e3",
            "name": "Pelargonium leaf curl virus",
            "abbreviation": "",
            "version": 0,
            "modified": false
        },
        {
            "virus_id": "d3a91e42",
            "name": "Pepper cryptic virus 1",
            "abbreviation": "",
            "version": 0,
            "modified": false
        }
    ]



Get
---

Get a specific virus document.

::

    GET /api/viruses/:virus_id


**Response**

.. code-block:: javascript

    Status: 200 OK

    {
        "version": 0,
        "abbreviation": "",
        "isolates": [
            {
                "default": true,
                "isolate_id": "91fec915",
                "sequences": [
                    {
                        "_id": "AF467107",
                        "annotated": true,
                        "definition": "Passion fruit yellow mosaic virus...",
                        "host": "",
                        "isolate_id": "91fec915",
                        "sequence": "AAGCGCATGCTTCGATTTCTTTTGCAGAAATG..."
                    }
                ],
                "source_name": "Colombia",
                "source_type": "isolate"
            }
        ],
        "last_indexed_version": 0,
        "lower_name": "passion fruit yellow mosaic virus",
        "modified": false,
        "name": "Passion fruit yellow mosaic virus",
        "user_id": "igboyes",
        "virus_id": "a28bf416"
    }



Create
------

Create a new virus document. Isolates and sequence data must be added in separate requests.

::

    POST /api/viruses


**Input**

+--------------+--------+----------+-------------------------------+
| Name         | Type   | Optional | Description                   |
+==============+========+==========+===============================+
| name         | string | False    | the virus name                |
+--------------+--------+----------+-------------------------------+
| abbreviation | string | True     | an abbreviation for the virus |
+--------------+--------+----------+-------------------------------+

**Response**

.. code-block:: javascript

    Status: 201 Created

    {
        "virus_id": "2f97f077",
        "user_id": "igboyes",
        "name": "Tobacco mosaic virus",
        "abbreviation": "TMV"
    }



Edit
----

Edit an existing virus.

::

    PATCH /api/viruses/:virus_id


**Input**

+--------------+--------+----------+-------------------------------+
| Name         | Type   | Optional | Description                   |
+==============+========+==========+===============================+
| name         | string | True     | the virus name                |
+--------------+--------+----------+-------------------------------+
| abbreviation | string | True     | an abbreviation for the virus |
+--------------+--------+----------+-------------------------------+

**Response**

.. code-block:: javascript

    Status: 200 OK

    {
        "virus_id": "2f97f077",
        "user_id": "igboyes",
        "name": "Tobacco Mosaic Virus",
        "abbreviation": "TMV"
    }



Verify
------

Verify a modified virus. The response will either be a verified virus document or a ``400`` response containing
verification error information.

::

    PUT /api/viruses/:virus_id/verify


**Responses**

.. code-block:: javascript

    Status: 200 OK

    {
        "virus_id": "6116cba1",
        "name": "Prunus virus F",
        "abbreviation": "PVF",
        "imported": True,
        "modified": False,
        "last_indexed_version": 0,
        "version": 1,
        "isolates": [
            {
                "default": True,
                "isolate_id": "cab8b360",
                "sequences": [
                    {
                        "sequence": "TGTTTAAGAGATTAAACAACCGCTTTC",
                        "host": "sweet cherry",
                        "definition": "Prunus virus F isolate 8816-s2...",
                        "accession": "KX269872",
                        "isolate_id": "cab8b360"
                    }
                ],
                "source_name": "8816-v2",
                "source_type": "isolate"
            }
        ]
    }

.. code-block:: javascript

    Status: 400 Bad Request

    {
        "message": "Verification errors",
        "errors": {
            "empty_isolate": ["cab8b360"],
            "empty_sequence": False,
            "empty_virus": False,
            "isolate_inconsistency": False
        }
    }


Remove
------

Remove an existing virus, its isolates, and sequences.

::

    DELETE /api/viruses/:virus_id


**Response**

.. code-block:: javascript

    Status: 204 No content



List Isolates
-------------

List the isolates for a given virus.

::

    GET /api/viruses/:virus_id/isolates


**Response**

.. code-block:: javascript

    Status: 200 OK

    [
        {
            "default": true,
            "isolate_id": "cab8b360",
            "source_name": "8816-v2",
            "source_type": "isolate"
        }
    ]



Get Isolate
-----------

Get a single, complete isolate for given virus and isolate ids.

::

    GET /api/viruses/:virus_id/isolates/:isolate_id


**Response**

.. code-block:: javascript

    Status: 200 OK

    {
        "isolate_id": "016e8f8f",
        "source_name": "16TFA020",
        "source_type": "internal",
        "default": false,
        "sequences": [
            {
                "sequence": "GACCGCTTTCGTTACCAGAAACCTCTTTCTACGTTCTCTGAACGTTTCTG...",
                "definition": "Prunus virus F, RNA2, complete sequence",
                "accession": "16TFA020_PVF_RNA2_B",
                "host": "Prunus"
            },
            {
                "sequence": "CCGCTTTCGATACCAGCTTCTTCTTACAGCTTTCGTTCTTAAGCCTTCTT...",
                "definition": "Prunus virus F, RNA1 complete sequence",
                "accession": "16TFA020_PVF_RNA1_B",
                "host": "Prunus"
            }
        ]
    }



Add Isolate
-----------

Add a new isolate to a virus.

Setting the isolate to default will steal default status from any existing default isolate. The first added isolate will
be set to default regardless of input.

::

    POST /api/viruses/:virus_id/isolates


**Input**

+--------------+---------+----------+--------------------------------------+
| Name         | Type    | Optional | Description                          |
+==============+=========+==========+======================================+
| source_type  | string  | True     | a source type (eg. isolate, variant) |
+--------------+---------+----------+--------------------------------------+
| source_name  | string  | True     | a source name (eg. 8816-v2, Jal-01)  |
+--------------+---------+----------+--------------------------------------+
| default      | boolean | True     | set the isolate as default           |
+--------------+---------+----------+--------------------------------------+

**Response**

.. code-block:: javascript

    Status: 201 Created

    {
        "isolate_id": "b4ce655d",
        "source_name": "Jal-01",
        "source_type": "isolate",
        "default": false,
        "sequences": []
    }



Edit Isolate
------------

Edit an existing isolate. Setting the isolate as default will unset any existing default isolates.

::

    PATCH /api/viruses/:virus_id/isolates/:isolate_id


**Input**

+--------------+---------+----------+--------------------------------------+
| Name         | Type    | Optional | Description                          |
+==============+=========+==========+======================================+
| source_type  | string  | True     | a source type (eg. isolate, variant) |
+--------------+---------+----------+--------------------------------------+
| source_name  | string  | True     | a source name (eg. 8816-v2, Jal-01)  |
+--------------+---------+----------+--------------------------------------+
| default      | boolean | True     | set the isolate as default           |
+--------------+---------+----------+--------------------------------------+

**Response**

.. code-block:: javascript

    Status: 200 OK

    {
        "default": true,
        "isolate_id": "b4ce655d",
        "source_name": "Jal-01",
        "source_type": "isolate",
        "sequences": []
    }



Remove Isolate
--------------

Remove an existing isolate and its sequences. If it is the default isolate, the first isolate in the list will be set as
default.

::

    DELETE /api/viruses/:virus_id/isolates/:isolate_id


**Response**

.. code-block:: javascript

    Status: 204 No content


List History
------------

Retrieve a list of all changes made to the virus.

::

    GET /api/viruses/:virus_id/history


**Response**

.. code-block:: javascript

    Status: 200

    {

    }
