===
HMM
===

Manage and query HMM annotations and files.

Find
----

Retrieve a list of HMM annotations, filtered by URL parameters.

::

    GET /hmm/annotations


Get
---

Retrieve a complete HMM annotation document.

::

    GET /hmm/annotations/:hmm_id

**Response**

.. code-block:: javascript

    {
        "hmm_id" : "1b73351e",
        "families" : {
            "Phycodnaviridae" : 2
        },
        "label" : "hypothetical protein H665_p091",
        "entries" : [
            {
                "organism" : "Ostreococcus tauri virus 1",
                "gi" : "260665960",
                "name" : "hypothetical protein H665_p091",
                "accession" : "YP_003212914.1"
            },
            {
                "organism" : "Ostreococcus lucimarinus virus OlV1",
                "gi" : "313844064",
                "name" : "hypothetical protein OlV1_094",
                "accession" : "YP_004061727.1"
            }
        ],
        "total_entropy" : 177.32,
        "count" : 2,
        "genera" : {
            "None" : 1,
            "Prasinovirus" : 1
        },
        "cluster" : 5810,
        "length" : 341,
        "definition" : [
            "hypothetical protein H665_p091",
            "hypothetical protein OlV1_094"
        ],
        "_version" : 0,
        "mean_entropy" : 0.52
    }


Set label
---------

Change the ``label`` field for a given HMM annotation.

::

    PUT /hmm/annotations/:hmm_id

**Input**

+----------+--------+----------------------------------------------------+
| Name     | Type   | Description                                        |
+==========+========+====================================================+
| label    | string | a new label for the HMM annotation                 |
+----------+--------+----------------------------------------------------+


**Response**

.. code-block:: javascript

    {
        "hmm_id" : "sj2ue98w",
        "label" : "Replicase"
    }


Check
-----

Modify the permissions assigned to a group. All fields are optional.

::

    GET /hmm/check


**Response**




Clean
-----

Remove annotation documents for which profiles do not exist in the application ``profiles.hmm`` file.

::

    GET /hmm/clean


**Response**

.. code-block:: javascript

    {
        "removed": ["sj2ue98w", "mb89xc0a"]
    }
