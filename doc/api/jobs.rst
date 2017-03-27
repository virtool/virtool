Jobs
====

Get
---

Retrieve a complete job document from the server.

::

    GET /jobs/job_id

**Response**

.. code-block:: javascript

    document = {
        _id: "f41e8c"
        _version: 7,
        task: "add_host",
        args: {
            _id: "Prunus persica",
            _version: 0,
            description: "Peach",
            file: "prunus_persica.fa",
            added: false,
            job: "f41e8c",
            username: "igboyes"
        },
        proc: 1,
        mem: 4,
        status: [
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
        username: "igboyes"
    }

Remove
------

::

    DELETE /jobs/:job_id



