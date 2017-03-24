=======
Samples
=======

Retrieve a sample
-----------------

Retrieve a complete sample document from the server.

::

    GET /samples/:sample_id


Remove a sample
---------------

Remove a sample document and all associated analyses.

::

    DELETE /samples/:sample_id


Modify a sample
---------------

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


Retrieve rights for a sample
----------------------------

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


Set rights for a sample
-----------------------

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


Get a list of analyses
----------------------

Retrieve a list of all analyses associated with a given sample. The complete analysis documents are not returned.

::

    GET /samples/:sample_id/analyses


Analyze a sample
----------------

Start a new analysis for a given sample.

::

    POST /samples/:sample_id/analyses




Retrieve an analysis
--------------------

Retrieve a complete analysis document given a ``sample_id`` and an ``analysis_id``.

::

    GET /samples/:sample_id/analyses/:analysis_id


BLAST a NuVs contig
-------------------

BLAST a contig that was generated as part of a NuVs analysis. This request will fail for non-NuVs analyses.

::

    POST /samples/:sample_id/analyses/:analysis_id/:sequence_index/blast


Remove a NuVs BLAST record
--------------------------

::

    DELETE /samples/:sample_id/analyses/:analysis_id/:sequence_index/blast


Remove an analysis
------------------

Remove an analysis given a ``sample_id`` and an ``analysis_id``.

::

    DELETE /samples/:sample_id/analyses/:analysis_id

