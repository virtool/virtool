=======
Account
=======

Used for authenticated users to modify their accounts.

.. note::

    These endpoints can only affect the account associated the requesting session.


Retrieve settings
-----------------

Retrieve all personalized settings.

::

    GET /account/settings

**Response**

.. code-block:: javascript

    {
        "quick_analyze_algorithm" : "pathoscope_bowtie",
        "skip_quick_analyze_dialog" : true,
        "show_ids" : true,
        "show_versions" : true
    }


Modify settings
---------------

Modify personalized settings. All fields are optional.

::

    PUT /account/settings

**Input**

+------------------------------+---------+-------------------------------------------------+
| Name                         | Type    | Description                                     |
+==============================+=========+=================================================+
| quick_analyze_algorithm      | string  | algorithm to use for quick analysis             |
+------------------------------+---------+-------------------------------------------------+
| skip_quick_analyze_dialog    | boolean | don't show the quick analysis dialog            |
+------------------------------+---------+-------------------------------------------------+
| show_ids                     | boolean | show document ids in client in where possible   |
+------------------------------+---------+-------------------------------------------------+
| show_versions                | boolean | show document versions in client where possible |
+------------------------------+---------+-------------------------------------------------+

**Response**

.. code-block:: javascript

    {
        "quick_analyze_algorithm" : "pathoscope_bowtie",
        "skip_quick_analyze_dialog" : true,
        "show_ids" : true,
        "show_versions" : true
    }


Change Password
---------------

Change the account password. An old password must be supplied.

::

    PUT /account/password

**Input**

+---------------+--------+-----------------------------------+
| Name          | Type   | Description                       |
+===============+========+===================================+
| old_password  | string | the old password for verification |
+---------------+--------+-----------------------------------+
| new_password  | string | the new password                  |
+---------------+--------+-----------------------------------+










