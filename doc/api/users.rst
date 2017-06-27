=====
Users
=====

Methods intended for user management by administrative users.


List
----

List the ``user_id`` for every user in the database.

::

    GET /users

**Response**

.. code-block:: javascript

    [
        "bob",
        "fred",
        "wilfred"
    ]


Get
---

Get a complete user document. Sensitive data including passwords, salts, and session tokens are removed.

::

    GET /users/:user_id


**Response**

.. code-block:: javascript

    {
        "user_id" : "bob",
        "invalidate_sessions" : true,
        "last_password_change" : "2017-02-17T13:58:25.792550",
        "primary_group" : "",
        "groups" : [],
        "settings" : {
            "quick_analyze_algorithm" : "pathoscope_bowtie",
            "skip_quick_analyze_dialog" : true,
            "show_ids" : true,
            "show_versions" : true
        },
        "force_reset" : false,
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
        }
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
        "invalidate_sessions" : true,
        "last_password_change" : "2017-02-17T13:58:25.792550",
        "primary_group" : "",
        "groups" : [],
        "settings" : {
            "quick_analyze_algorithm" : "pathoscope_bowtie",
            "skip_quick_analyze_dialog" : true,
            "show_ids" : true,
            "show_versions" : true
        },
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
