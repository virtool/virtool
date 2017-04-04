Overview
========

Errors
------

JSON Errors
~~~~~~~~~~~

JSON input that cannot be parsed, results in a ``400 Bad Request`` response. No more information is provided with the
response, so make sure your JSON is formatted properly!

::

    400 Bad Request

    {"message": "Invalid JSON"}

- `jsonapi.org <http://jsonapi.org/>`_
- `Python JSON encoder and decoder <https://docs.python.org/3.5/library/json.html>`_


Login Errors
~~~~~~~~~~~~

For some endpoints, an authorized session is required. An authorized session is obtained by logging in and acquiring
a ``session_id`` cookie. Accessing user-specific endpoints like ``GET /api/account`` will result in the following error.

::

    400 Bad Request

    {"message": "Requires login"}


Input Validation Errors
~~~~~~~~~~~~~~~~~~~~~~~

JSON input data for POST and PUT endpoints are validated using Cerberus. Validation
errors will result in a ``422 Unprocessable Entity`` response. The response data includes the default Cerberus error
report. Refer to the `Cerberus documentation <http://docs.python-cerberus.org/en/stable/usage.html>`_.

::

    422 Unprocessable Entity

    {
        "message": "Invalid input",
        "errors": {
            "foo_bar": ["unknown field"],
            "new_password": ["required field"],
            "old_password": ["required field"]
        }
    }


In this example, the ``foo_bar`` field is not expected in the request. The required ``new_password`` and
``old_password`` fields are missing from the request. Refer to the input definition tables for each endpoint in the
documentations to make sure your inputs are valid.

