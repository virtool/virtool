"""The data layer abstracts access to the application database and storage into a
collection of classes and methods that provide a consistent interface.

.. code-block:: python

    user = await data.users.create()

Rules
=====

- Creation of any resource is done via a data layer method called ``create()``.
- All data layer methods are asynchronous and return awaitable coroutines.
- Data layer methods should not return raw database objects, but rather
  application-specific objects that are easy to work with.

"""
