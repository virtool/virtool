======
Groups
======

Manage user groups.

List groups
-------------------------

Retrieve a list of all existing groups. The list on contains the ``group_id`` for each group.

::

    GET /groups/

**Response**

.. code-block:: javascript

    {
        "groups": [
            "administrator",
            "diagnostics",
            "technician",
            "research"
        ]
    }


Create
------

Create a user group. A ``group_id`` **must** be provided. By default, new groups
have no permissions.

::

    POST /groups

**Input**

+----------+--------+----------------------------------------------------+
| Name     | Type   | Description                                        |
+==========+========+====================================================+
| group_id | string | a unique id and display name for the group         |
+----------+--------+----------------------------------------------------+

**Response**

.. code-block:: javascript

    {
        "group_id" : "technician",
        "permissions" : {
            "remove_job" : false,
            "add_virus" : false,
            "archive_job" : false,
            "modify_hmm" : false,
            "add_host" : false,
            "cancel_job" : false,
            "remove_virus" : false,
            "modify_virus" : false,
            "add_sample" : false,
            "modify_options" : false,
            "remove_host" : false,
            "rebuild_index" : false
        }
    }


Get
---

Retrieve a complete group document.

::

    GET /groups/:group_id

**Response**

.. code-block:: javascript

    {
        "group_id" : "technician",
        "permissions" : {
            "remove_job" : false,
            "add_virus" : true,
            "archive_job" : false,
            "modify_hmm" : false,
            "add_host" : true,
            "cancel_job" : false,
            "remove_virus" : false,
            "modify_virus" : false,
            "add_sample" : true,
            "modify_options" : false,
            "remove_host" : false,
            "rebuild_index" : false
        }
    }


Set Permissions
---------------

Modify the permissions assigned to a group. All fields are optional.

::

    PUT /groups/:group_id

**Input**

+-----------------+---------+-----------------------------------------------------------+
| Name            | Type    | Description                                               |
+=================+=========+===========================================================+
| add_sample      | boolean | members can add samples                                   |
+-----------------+---------+-----------------------------------------------------------+
| modify_sample   | boolean | members can modify samples if they have sufficient rights |
+-----------------+---------+-----------------------------------------------------------+
| cancel_job      | boolean | members can cancel any job                                |
+-----------------+---------+-----------------------------------------------------------+
| remove_job      | boolean | members can remove job documents                          |
+-----------------+---------+-----------------------------------------------------------+
| modify_virus    | boolean | members can add and modify virus documents                |
+-----------------+---------+-----------------------------------------------------------+
| remove_virus    | boolean | members can remove virus documents                        |
+-----------------+---------+-----------------------------------------------------------+
| rebuild_index   | boolean | members can rebuild virus indexes                         |
+-----------------+---------+-----------------------------------------------------------+
| modify_hmm      | boolean | members can add and modify hmm annotations and files      |
+-----------------+---------+-----------------------------------------------------------+
| modify_host     | boolean | members can add and modify host documents and files       |
+-----------------+---------+-----------------------------------------------------------+
| remove_host     | boolean | members can remove host documents and files               |
+-----------------+---------+-----------------------------------------------------------+
| modify_options  | boolean | members can modify global options                         |
+-----------------+---------+-----------------------------------------------------------+

**Response**

.. code-block:: javascript

    {
        "remove_job" : false,
        "add_virus" : true,
        "archive_job" : false,
        "modify_hmm" : false,
        "add_host" : true,
        "cancel_job" : false,
        "remove_virus" : false,
        "modify_virus" : false,
        "add_sample" : true,
        "modify_options" : false,
        "remove_host" : false,
        "rebuild_index" : false
    }


Remove
------

Remove a group. This will fail if for the built-in administrator group.

::

    DELETE /groups/:group_id

**Response**

.. code-block:: javascript

    {
        "quick_analyze_algorithm" : "pathoscope_bowtie",
        "skip_quick_analyze_dialog" : true,
        "show_ids" : true,
        "show_versions" : true
    }
