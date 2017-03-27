=====
Users
=====

Methods intended for user management by administrative users.


List
----

List the ``user_ids`` for all users in the database.

::

    GET /users

.. code-block:: javascript

    {
        users: [
            "bob",
            "fred",
            "wilfred"
        ]
    }


Get
---

Get a complete user document. Sensitive data including passwords, salts, and session tokens are removed.

::

    GET /users/:user_id


**Response**

.. code-block:: javascript

    {
        "user_id" : "bob",
        "_version" : 13,
        "invalidate_sessions" : true,
        "last_password_change" : "2017-02-17T13:58:25.792550",
        "primary_group" : "",
        "groups" : [],
        "settings" : {},
        "permissions" : {
            "remove_virus" : false,
            "rebuild_index" : false,
            "remove_job" : false,
            "cancel_job" : false,
            "modify_hmm" : false,
            "archive_job" : false,
            "remove_host" : false,
            "add_host" : false,
            "add_virus" : false,
            "modify_virus" : false,
            "modify_options" : false,
            "add_sample" : false
        },
        "sessions" : [
            {
                "browser" : {
                    "name" : "Firefox",
                    "version" : "51.0"
                },
                "token" : "92b16f56663da0fec99e8cda",
                "ip" : "127.0.0.1",
                "timestamp" : "2017-02-06T13:00:07.664126"
            }
        ],
        "force_reset" : false
    }


Create
------

Create a new user.

::

    POST /users


**Input**

+-------------+--------+----------+----------------------------------------------------------------+
| Name        | Type   | Required | Description                                                    |
+=============+========+==========+================================================================+
| user_id     | String | True     | the desired username                                           |
+-------------+--------+----------+----------------------------------------------------------------+
| password    | String | True     | the desired password                                           |
+-------------+--------+----------+----------------------------------------------------------------+
| force_reset | String | False    | force password reset on login (default=``True``)               |
+-------------+--------+----------+----------------------------------------------------------------+

**Response**

.. code-block:: javascript

    {
        "user_id" : "fred",
        "_version" : 0,
        "invalidate_sessions" : true,
        "last_password_change" : "2017-02-17T13:58:25.792550",
        "primary_group" : "",
        "groups" : [],
        "settings" : {},
        "permissions" : {
            "remove_virus" : false,
            "rebuild_index" : false,
            "remove_job" : false,
            "cancel_job" : false,
            "modify_hmm" : false,
            "archive_job" : false,
            "remove_host" : false,
            "add_host" : false,
            "add_virus" : false,
            "modify_virus" : false,
            "modify_options" : false,
            "add_sample" : false
        },
        "sessions" : [
            {
                "browser" : {
                    "name" : "Firefox",
                    "version" : "51.0"
                },
                "token" : "92b16f56663da0fec99e8cda",
                "ip" : "127.0.0.1",
                "timestamp" : "2017-02-06T13:00:07.664126"
            }
        ],
        "force_reset" : true
    }


Remove session
--------------

Forcefully remove a session. This will interrupt any users using the session.

::

    DELETE /users/:user_id/sessions/:token


**Response**

.. code-block:: javascript

    {
        "removed": "ab78n0po"
    }


Remove
------

Remove a user.

::

    DELETE /users/:user_id

**Response**

.. code-block:: javascript

    {
        "removed": "bob"
    }
