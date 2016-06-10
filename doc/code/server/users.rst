Users
=====

Users Collection
----------------

All user management, excluding `permissions <user-permissions>`_, is done through :class:`.users.Collection`.

.. autoclass:: virtool.users.Collection
    :show-inheritance:

Overridden :meth:`~.database.Collection.update` Method
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When one or more user documents are modified there can be consequences for any active connections owned by the modified
users. The :meth:`.database.Collection.update` method is overridden in :class:`.users.Collection` to provide special
functionality to account for changes to active users.

.. automethod:: virtool.users.Collection.update

The redefined method has the same signature as the method in the :class:`~.database.Collection` base class sends an
``amend`` operation with a copy of the new user document to connections owned by the modified users. This allows the
client to update its views in response to user changes, particularly those related to `permissions <user-permissions>`_.
The user dict referenced by :attr:`.web.SocketHandler.user` is also updated so permissions can be checked on the server
side.

Authentication
--------------

The goal of authentication is the verify the identity of the connecting user, pass them their user information, and
authorize their connection to call protected `exposed methods <exposed-methods>`_.

There are two ways to authenticate a connection. The first is by validating a username and password passed in from the
login view. This is done by requesting the unprotected exposed method :meth:`.authorize_by_login`.

.. automethod:: virtool.users.Collection.authorize_by_login

If this request succeeds a new `session <user-sessions>`_ is created for the user and a unique token identifying the
session is passed to the client. This token is stored as a cookie by the client and When it loads the application again,
it will attempt to authorize the connection by passing the token to the server. This is done through the
unprotected exposed method :meth:`.authorize_by_token`.

.. automethod:: virtool.users.Collection.authorize_by_token

The method :meth:`.validate_login` is used to validate username and password combinations. It is called in
:meth:`.authorize_by_token` and :meth:`.change_password`.

.. automethod:: virtool.users.Collection.validate_login

.. _user-sessions:

Sessions
--------

When a user successfully logs in, a session token is stored as a cookie in the browser. When the user next loads the
application the token will be passed to the server to attempt to gain authorization without entering user credentials.

When

.. _user-passwords:

Passwords
---------

Passwords are used to authenticate users in Virtool. They are stored in user documents and are
`salted <https://en.wikipedia.org/wiki/Salt_(cryptography)>`_ and
`hashed <https://en.wikipedia.org/wiki/Cryptographic_hash_function>`_ to prevent dictionary attacks if the user data is
compromised.

The function :func:`.salt_hash` is used for salting and hashing new passwords before they are stored in the users
collection. It is also used for testing passwords during login.

.. autofunction:: virtool.users.salt_hash

Changing Passwords
~~~~~~~~~~~~~~~~~~

Two different exposed methods are used to change passwords. Users can change their own passwords using
:meth:`.change_password`, while users with the *modify_option* permission can change other users' passwords using
:meth:`.set_password`.

.. automethod:: virtool.users.Collection.change_password

.. automethod:: virtool.users.Collection.set_password

Forcing Password Resets
~~~~~~~~~~~~~~~~~~~~~~~

It is sometimes necessary to force a user to reset their password. This is accomplished by setting the ``force_reset``
field in the user document to ``True`` using the :meth:`.set_force_reset` exposed method. This method can only be
requested by users with the *modify_options* permission.

.. automethod:: virtool.users.Collection.set_force_reset

Groups
------

Users gain permissions **only** by inheriting them from their assigned groups. Consequently, groups must be used for all
management of user permissions.

UNIX-like access permissions are used for controlling access to sample documents. Samples can be assigned a user group
and access permissions during creation. These settings can also be modified after sample creation using
:meth:`~.samples.Collection.set_rights`. Groups are therefore used to manage access to sample documents.

Setting Group Membership
~~~~~~~~~~~~~~~~~~~~~~~~

Group membership can be set for a single user using the :meth:`.set_group` method.

.. automethod:: virtool.users.Collection.set_group

Primary Groups
~~~~~~~~~~~~~~

Virtool can be configured to automatically set the owner group of a new sample as the *primary group* of the creating
user. The primary group of a user is modified by calling the :meth:`.set_primary_group` method.

.. automethod:: virtool.users.Collection.set_primary_group

Groups Collection
~~~~~~~~~~~~~~~~~

The :class:`virtool.groups.Collection` object provides an interface for modifying group documents stored in MongoDB.
Groups are used for managing user permissions and access to sample documents.

.. note::

    The *administrator* group is included in Virtool by default and cannot be removed or modified without changing code
    or directly manipulating the database. The administrator group has every permission and is assigned to the user
    created during initial setup.

.. autoclass:: virtool.groups.Collection
    :show-inheritance:
    :members:
    :member-order: bysource

.. _user-permissions:

Permissions
-----------

Each group possesses *permissions* that allow its member users to perform certain operations. Permissions are stored in
a group database document as a :class:`dict` of permission name keys with booleans as values. The permissions used in
Virtool are:

==============  ==========================================================
Permission      Description
==============  ==========================================================
add_virus       User may add a virus.
modify_virus    User may modify an existing virus or revert history items.
remove_virus    User may remove a virus from the viruses collection
add_sample      User may add a sample, initiating an *import_reads* job.
add_host        User may add a host, initiating an 'add_host' job.
remove_host     User may remove a host.
cancel_job      User may cancel a running job.
remove_job      User may remove a finished job.
archive_job     User may archive a finished job.
rebuild_index   User may rebuild the virus index.
modify_options  User may edit server options and modify users.
==============  ==========================================================

Global :data:`~.groups.PERMISSIONS`  Variable
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The module variable :data:`.groups.PERMISSIONS` contains a list of all possible permissions. This list of permissions is
used to generate permission dicts for new groups and to update user and groups permissions when changes are made to a
group's permissions or :data:`.groups.PERMISSIONS` changes.

.. autodata:: virtool.groups.PERMISSIONS
    :annotation: = []

Updating a User's Permissions
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A user's permissions must be updated in two instances:

1. When the permissions of a group, to which the user belongs, change.
2. When the user gains or loses membership in a group.

The :meth:`.users.Collection.update_user_permissions` method deals with these situations.

.. automethod:: virtool.users.Collection.update_user_permissions

.. autofunction:: virtool.users.reconcile_permissions

.. _user-settings:

User Settings
-------------

Users can set personal settings for their sessions. These settings are stored in the ``settings`` field of the user
document. Currently implemented user settings are:

+----------------+-----------------------------------------------------------------------+
| Key            | Additional Information                                                |
+================+=======================================================================+
| show_ids       | show the ids of documents in the client view were applicable          |
+----------------+-----------------------------------------------------------------------+
| show_versions  | show the ids of documents in the client view were applicable          |
+----------------+-----------------------------------------------------------------------+

Settings can be modified, one key per call, with :meth:`~.users.Collection.change_user_setting`. Users can
only change their own settings.

.. automethod:: virtool.users.Collection.change_user_setting

User Documents
--------------

User documents have the following structure:

+----------------------+--------------------------------------------------------------------------------+
| Key                  | Additional Information                                                         |
+======================+================================================================================+
| _id                  | the unique id for the user document, which is also the username                |
+----------------------+--------------------------------------------------------------------------------+
| _version             | the version of the document                                                    |
+----------------------+--------------------------------------------------------------------------------+
| groups               | an array containing the ids of the groups the user belongs to                  |
+----------------------+--------------------------------------------------------------------------------+
| primary_group        | the primary group of the user for assigning group ownership to                 |
|                      | created samples                                                                |
+----------------------+--------------------------------------------------------------------------------+
| salt                 | the string used to `salt <user-passwords>`_ the password                       |
|                      | before it was hashed                                                           |
+----------------------+--------------------------------------------------------------------------------+
| password             | the user's salted and hashed password                                          |
+----------------------+--------------------------------------------------------------------------------+
| last_password_change | the ISO date and time the password was last changed                            |
+----------------------+--------------------------------------------------------------------------------+
| settings             | a JSON object containing the user's `personal settings <user-settings>`_       |
+----------------------+--------------------------------------------------------------------------------+
| sessions             | a list of the user's `session <user-sessions>`_ objects                        |
+----------------------+--------------------------------------------------------------------------------+
| permissions          | an object describing the user's `permissions <user-permissions>`_              |
+----------------------+--------------------------------------------------------------------------------+
| invalidate_sessions  | a boolean indicating whether the user's sessions next time                     |
|                      | they authorize                                                                 |
+----------------------+--------------------------------------------------------------------------------+
| force_reset          | a boolean indicating whether the user should be forced to                      |
|                      | reset their password                                                           |
+----------------------+--------------------------------------------------------------------------------+

Adding Users
~~~~~~~~~~~~

Before a new user is added, we should check the database to make sure the requested username (id) doesn't already exist.

.. automethod:: virtool.users.Collection.user_exists

Adding users is accomplished by requesting the :meth:`.users.Collection.add` exposed method.

.. automethod:: virtool.users.Collection.add

Removing Users
~~~~~~~~~~~~~~

Users are removed with the :meth:`.remove_user` exposed method.

.. automethod:: virtool.users.Collection.remove_user

