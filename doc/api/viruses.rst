Viruses
=======

Manage viruses and their change history.


Find
----

Find truncated virus document based on filters described in URL parameters.

::

    GET /api/viruses

Get
---

Get a specific virus document.

::

    GET /api/viruses/:virus_id


Create
------

Create a new virus document. Isolates and sequence data must be added in separate requests.

::

    POST /api/viruses


**Input**

+--------------+--------+-------------------------------+
| Name         | Type   | Description                   |
+==============+========+===============================+
| name         | string | the virus name                |
+--------------+--------+-------------------------------+
| abbreviation | string | an abbreviation for the virus |
+--------------+--------+-------------------------------+

**Response**

.. code-block:: javascript

    {
        "virus_id": "2f97f077"
        "name": "Tobacco mosaic virus",
        "abbreviation": "TMV"
    }


