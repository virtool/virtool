"""Update Virtool so that it depends on a revision having been applied."""

import click

from virtool.migration.show import load_all_revisions


def depend(revision: str = "latest") -> None:
    """Update Virtool so that it depends on a revision having been applied.

    Checks the Alembic and Virtool revision to ensure that the specified revision
    exists. Then, sets Virtool's REQUIRED_VIRTOOL_REVISION to the specified
    revision.

    If the revision is "latest", it will depend on the most recent revision file.
    """
    all_revisions = load_all_revisions()

    if revision == "latest":
        revision = all_revisions[-1].id

    if revision not in [r.id for r in all_revisions]:
        click.echo(f"Revision {revision} does not exist.", err=True)
        return

    try:
        with open("virtool/migration/required.py") as f:
            lines = f.readlines()

        with open("virtool/migration/required.py", "w") as f:
            for line in lines:
                if line.startswith("REQUIRED_VIRTOOL_REVISION"):
                    f.write(f'REQUIRED_VIRTOOL_REVISION = "{revision}"\n')
                else:
                    f.write(line)
    except FileNotFoundError:
        click.echo("Error: required.py file not found.", err=True)
    except PermissionError:
        click.echo("Error: Insufficient permissions to modify required.py.", err=True)
