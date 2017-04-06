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

    [
        {
            "abbreviation": "",
            "modified": false,
            "name": "Passiflora chlorosis virus",
            "virus_id": "8eef7ebd"
        },
        {
            "abbreviation": "PVF",
            "modified": false,
            "name": "Prunus virus F",
            "virus_id": "6116cba1"
        },
        {
            "abbreviation": "EV_TF3-mycovirus",
            "modified": false,
            "name": "Endornavirus of Tree Fruit #3",
            "virus_id": "5350af44"
        }
    ]



Get
---

Get a specific virus document.

::

    GET /api/viruses/:virus_id


**Response**

.. code-block:: javascript

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
| name         | string | True     | the virus name                |
+--------------+--------+----------+-------------------------------+
| abbreviation | string | False    | an abbreviation for the virus |
+--------------+--------+----------+-------------------------------+

**Response**

.. code-block:: javascript

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

    PUT /api/viruses/:virus_id


**Input**

+--------------+--------+----------+-------------------------------+
| Name         | Type   | Optional | Description                   |
+==============+========+==========+===============================+
| name         | string | True     | the virus name                |
+--------------+--------+----------+-------------------------------+
| abbreviation | string | False    | an abbreviation for the virus |
+--------------+--------+----------+-------------------------------+

**Response**

.. code-block:: javascript

    {
        "virus_id": "2f97f077",
        "user_id": "igboyes",
        "name": "Tobacco Mosaic Virus",
        "abbreviation": "TMV"
    }



Remove
------

Edit an existing virus.

::

    PUT /api/viruses/:virus_id


**Response**

.. code-block:: javascript

    {
        "removed": "2f97f077"
    }



List Isolates
-------------

List the isolates for a given virus.

::

    GET /api/viruses/:virus_id/isolates


**Response**

.. code-block:: javascript

    [
        {
            "default": true,
            "isolate_id": "cab8b360",
            "source_name": "8816-v2",
            "source_type": "isolate"
        },
        {
            "default": false,
            "isolate_id": "016e8f8f",
            "source_name": "16TFA020",
            "source_type": "internal"
        },
        {
            "default": false,
            "isolate_id": "dbb82643",
            "source_name": "13TF122",
            "source_type": "internal"
        }
    ]



Get Isolate
-----------

Get a single, complete isolate for given virus and isolate ids.

::

    GET /api/viruses/:virus_id/isolates/:isolate_id


**Response**

.. code-block:: javascript

    {
        "default": true,
        "isolate_id": "cab8b360",
        "sequences": [
            {
                "_id": "KX269872",
                "annotated": true,
                "definition": "Prunus virus F isolate 8816-s2 segment...",
                "host": "sweet cherry",
                "isolate_id": "cab8b360",
                "sequence": "TGTTTAAGAGATTAAACAACCGCTTTCGTTACCAGAAACTGCT..."
            }
        ],
        "source_name": "8816-v2",
        "source_type": "isolate"
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

    {
        "default": false,
        "isolate_id": "b4ce655d",
        "source_name": "Jal-01",
        "source_type": "isolate",
        "sequences": []
    }



Edit Isolate
------------

Edit an existing isolate. Setting the isolate as default will unset any existing default isolates.

::

    PUT /api/viruses/:virus_id/isolates/:isolate_id


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

    {
        "default": true,
        "isolate_id": "b4ce655d",
        "source_name": "Jal-01",
        "source_type": "isolate",
        "sequences": []
    }




