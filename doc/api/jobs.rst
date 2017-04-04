Jobs
====


Find
----

Retrieve a list of job documents based on filters defined in URL parameters.

::

    GET /api/jobs?term=nuvs&sort=timestamp


**Parameters**

+----------+---------+----------------------------------+
| Name     | Type    | Description                      |
+==========+=========+==================================+
| term     | string  | filters by username or task name |
+----------+---------+----------------------------------+
| sort     | string  | a document field to sort by      |
+----------+---------+----------------------------------+

**Response**

.. code-block:: javascript

    [
        {
            "job_id": "f41e8c"
            "task": "add_host",
            "proc": 1,
            "mem": 4,
            "state": "running",
            "stage": "snap_build",
            "progress": 0.571,
            "added": "2016-08-25T11:48:22.375557"
            "user_id": "igboyes"
        },
        {
            "job_id": "jk98ty"
            "task": "import_reads",
            "proc": 1,
            "mem": 4,
            "state": "running",
            "stage": "snap_build",
            "progress": 0.231,
            "added": "2016-08-25T11:48:22.375557"
            "user_id": "igboyes"
        },
        {
            "job_id": "89thy0"
            "task": "pathoscope_bowtie",
            "proc": 1,
            "mem": 4,
            "state": "running",
            "stage": "map_host",
            "progress": 1.0,
            "added": "2016-04-25T11:23:11.375557"
            "user_id": "igboyes"
        }
    ]


Get
---

Retrieve a complete job document from the server.

::

    GET /api/jobs/job_id


**Response**

.. code-block:: javascript

    {
        "job_id": "f41e8c"
        "task": "add_host",
        "args": {
            "_id": "Prunus persica",
            "_version": 0,
            "description": "Peach",
            "file": "prunus_persica.fa",
            "added": false,
            "job": "f41e8c",
            "username": "igboyes"
        },
        "proc": 1,
        "mem": 4,
        "status": [
            {
                "stage" : "bowtie_build",
                "progress" : 0.429,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:48:22.375557"
            },
            {
                "stage" : "snap_build",
                "progress" : 0.571,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:52:18.472402"
            },
            {
                "stage" : "update_db",
                "progress" : 0.714,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:53:24.774645"
            },
        ],
        "user_id": "igboyes"
    }


Cancel
------

Cancel a running or waiting job. Will fail with ``422`` for any input other than :json:`"{'cancel': true}"`.

::

    PUT /api/jobs/:job_id


**Input**

+----------+---------+----------------------------------+
| Name     | Type    | Description                      |
+==========+=========+==================================+
| cancel   | bool    | **must** be ``true``             |
+----------+---------+----------------------------------+

**Response**

.. code-block:: javascript

    {
        "job_id": "f41e8c"
        "task": "add_host",
        "args": {
            "_id": "Prunus persica",
            "_version": 0,
            "description": "Peach",
            "file": "prunus_persica.fa",
            "added": false,
            "job": "f41e8c",
            "username": "igboyes"
        },
        "proc": 1,
        "mem": 4,
        "status": [
            {
                "stage" : "bowtie_build",
                "progress" : 0.429,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:48:22.375557"
            },
            {
                "stage" : "snap_build",
                "progress" : 0.571,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:52:18.472402"
            },
            {
                "stage" : "update_db",
                "progress" : 0.714,
                "error" : null,
                "state" : "running",
                "date" : "2016-08-25T11:53:24.774645"
            },
            {
                "stage" : "update_db",
                "progress" : 0.714,
                "error" : null,
                "state" : "cancelled",
                "date" : "2016-08-25T11:55:54.475545"
            },
        ],
        "user_id": "igboyes"
    }


Remove
------

Remove a job document. The job must not be running or waiting

::

    DELETE /api/jobs/:job_id

**Response**

.. code-block:: javascript

    {
        "removed": "f41e8c"
    }
