=======
Samples
=======

Find
----

Retrieve a list of samples, filtered by URL parameters.

::

    GET /samples


**Response**

.. code-block:: javascript


    [
        {
            "username": "heidi",
            "group_read": true,
            "name":"16SP017-M",
            "archived":true,
            "group_write":true,
            "_version":56,
            "nuvs":false,
            "_id":"21f6f983",
            "group":"biotech",
            "all_write":false,
            "added":"2016-07-20T15:07:52.579347",
            "imported":true,
            "pathoscope":false,
            "all_read":true
        },

        {
            "username":"heidi",
            "group_read":true,
            "name":"16SP021-M",
            "archived":true,
            "group_write":true,
            "_version":56,
            "nuvs":false,
            "_id":"92e2887d",
            "group":"biotech",
            "all_write":false,
            "added":"2016-07-20T15:09:09.299341",
            "imported":true,
            "pathoscope":false,
            "all_read":true
        }
    ]


Get
---

Retrieve a complete sample document from the server.

::

    GET /samples/:sample_id


Remove
------

Remove a sample document and all associated analyses.

::

    DELETE /samples/:sample_id


Update
------

Edit modifiable fields in a sample document.

::

    PUT /samples/:sample_id

**Input**

+----------+---------+----------------------------------+
| Name     | Type    | Description                      |
+==========+=========+==================================+
| name     | string  | a new name for the sample        |
+----------+---------+----------------------------------+
| host     | string  | the exact (not subtraction) host |
+----------+---------+----------------------------------+
| isolate  | string  | the originating isolate          |
+----------+---------+----------------------------------+
| archived | boolean | archive state of the sample      |
+----------+---------+----------------------------------+


Get rights
----------

Retrieve the owner group and rights for the sample.

::

    GET /samples/:sample_id/rights

**Response**

.. code-block:: javascript

    {
        "group": "diagnostics",
        "group_read": true,
        "group_write": true,
        "all_read": true,
        "all_write": false
    }


Modify rights
-------------

Set the rights fields and the owner group for a given sample. All fields are optional.

::

    PUT /samples/:sample_id/rights

**Input**

+--------------+---------+-----------------------------+
| Name         | Type    | Description                 |
+==============+=========+=============================+
| group        | string  | the owner ``group_id``      |
+--------------+---------+-----------------------------+
| group_read   | boolean | group can read sample       |
+--------------+---------+-----------------------------+
| group_write  | boolean | group can modify sample     |
+--------------+---------+-----------------------------+
| all_read     | boolean | all users can read sample   |
+--------------+---------+-----------------------------+
| all_write    | boolean | all users can modify sample |
+--------------+---------+-----------------------------+

**Response**

.. code-block:: javascript

    {
        "group": "research",
        "group_read": true,
        "group_write": false,
        "all_read": false,
        "all_write": false
    }


List analyses
----------------

Retrieve a list of all analyses associated with a given sample. The complete analysis documents are not returned.

::

    GET /samples/:sample_id/analyses


Analyze
-------

Start a new analysis for a given sample.

::

    POST /samples/:sample_id/analyses




Get analysis
------------

Retrieve a complete analysis document given a ``sample_id`` and an ``analysis_id``.

::

    GET /samples/:sample_id/analyses/:analysis_id


BLAST a contig
--------------

BLAST a contig that was generated as part of a NuVs analysis. This request will fail for non-NuVs analyses.

::

    POST /samples/:sample_id/analyses/:analysis_id/:sequence_index/blast


Remove BLAST record
-------------------

::

    DELETE /samples/:sample_id/analyses/:analysis_id/:sequence_index/blast


Remove analysis
---------------

Remove an analysis given a ``sample_id`` and an ``analysis_id``.

::

    DELETE /samples/:sample_id/analyses/:analysis_id

