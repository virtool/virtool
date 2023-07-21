"""
The data layer abstracts access to the application database and storage into a
collection of classes and methods that provide a consistent interface.

.. code-block:: python

    user = await data.users.create()

Data Layer Rules:

- Creation of any resource is done via a data layer called ``create()``.

"""
