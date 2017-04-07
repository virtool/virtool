History
=======

Find
----

Find and filter changes by URL parameters. Excludes ``diff`` and ``annotation`` fields.

::

    GET /api/history


**Response**

.. code-block:: javascript

    Status: 200 OK

    [
        {
            "change_id": "c1e16d2c.10",
            "index": "465428b0",
            "index_version": 1,
            "method_name": "verify_virus",
            "operation": "update",
            "timestamp": "2017-03-07T15:52:12.676269",
            "user_id": "igboyes",
            "virus_id": "c1e16d2c",
            "virus_name": "Apple stem pitting virus and Apricot latent virus",
            "virus_version": 10
        },
        {
            "change_id": "190fe042.3",
            "index": "465428b0",
            "index_version": 1,
            "method_name": "verify_virus",
            "operation": "update",
            "timestamp": "2017-03-07T15:52:16.736736",
            "user_id": "igboyes",
            "virus_id": "190fe042",
            "virus_name": "Nectarine stem pitting associated virus",
            "virus_version": 3
        },
        {
            "change_id": "cf189b66.0",
            "index": "9cd17bac",
            "index_version": 0,
            "method_name": "add",
            "operation": "insert",
            "timestamp": "2017-02-03T14:29:31.789583",
            "user_id": "igboyes",
            "virus_id": "cf189b66",
            "virus_name": "Iris yellow spot virus",
            "virus_version": 0
        }
    ]



Get
---

Get a specific change by its ``change_id``. Includes ``diff`` and ``annotation`` fields.

.. code-block:: none

    GET /api/history/c1e16d2c.10


**Response**

.. code-block:: javascript

    {
        "annotation": null,
        "change_id": "c1e16d2c.10",
        "diff": [
            [
                "change",
                "modified",
                [
                    true,
                    false
                ]
            ],
            [
                "change",
                "_version",
                [
                    9,
                    10
                ]
            ]
        ],
        "index": "465428b0",
        "index_version": 1,
        "method_name": "verify_virus",
        "operation": "update",
        "timestamp": "2017-03-07T15:52:12.676269",
        "user_id": "igboyes",
        "virus_id": "c1e16d2c",
        "virus_name": "Apple stem pitting virus and Apricot latent virus",
        "virus_version": 10
    }
