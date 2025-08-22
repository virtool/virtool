import importlib
import json

import click

from virtool.oas.view import generate_oas


def show_oas():
    """Display Open API Specification on the stdout."""
    app = importlib.import_module("virtool.oas.app").app
    spec = generate_oas(app)

    for path in spec["paths"].values():
        for operation in ("get", "patch", "post", "put", "delete"):
            try:
                operation_dict = path[operation]
                description = operation_dict["description"]
            except KeyError:
                continue

            split_description = description.split("\n")

            operation_dict.update(
                {
                    "summary": split_description[0].strip().rstrip("."),
                    "description": "\n".join(split_description[1:]).lstrip("\n"),
                }
            )

    click.echo(json.dumps(spec, sort_keys=True, indent=4))
