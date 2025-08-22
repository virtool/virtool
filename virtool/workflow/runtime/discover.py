import sys
from importlib import import_module
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import ModuleType

from structlog import get_logger

from virtool.workflow import Workflow
from virtool.workflow.decorators import collect

logger = get_logger("runtime")


def discover_workflow(path: Path) -> Workflow:
    """Find an instance of :class:`.Workflow` in a Python module.

    :param path: The path to a Python module.
    :return: The first :class:`.Workflow` class in the module.
    :raises ValueError: No workflow definition found.
    """
    module = import_module_from_file(path.name.rstrip(path.suffix), path)

    try:
        return next(
            attr for attr in module.__dict__.values() if isinstance(attr, Workflow)
        )
    except StopIteration:
        return collect(module)


def load_builtin_fixtures():
    """Load built-in fixtures.

    This function is called before any fixtures defined in a workflow's
    ``fixtures.py`` file. It is used to provide built-in fixtures that are
    required for the workflow to run.

    """
    import_module("virtool.workflow.data")
    import_module("virtool.workflow.analysis.fastqc")
    import_module("virtool.workflow.analysis.skewer")
    import_module("virtool.workflow.runtime.run_subprocess")


def load_custom_fixtures():
    """Load fixtures defined by the workflow author in ``fixtures.py``."""
    logger.info("importing fixtures.py")

    fixtures_path = Path("./fixtures.py")

    try:
        import_module_from_file(fixtures_path.name.rstrip(".py"), fixtures_path)
    except FileNotFoundError:
        logger.info("could not find fixtures.py")


def load_workflow_from_file() -> Workflow:
    """Load a workflow from a Python file at ``./workflow.py`` and return a :class:`.Workflow` object.

    :raises FileNotFoundError: If no workflow.py file is found.
    :return: The workflow.
    """
    logger.info("importing workflow.py")

    try:
        return discover_workflow(Path("./workflow.py"))
    except FileNotFoundError:
        logger.critical("could not find workflow.py")
        sys.exit(1)


def import_module_from_file(module_name: str, path: Path) -> ModuleType:
    """Import a module from a file.

    The parent directory of `path` will also be added to `sys.path` prior to importing.
    This ensures that modules and packages defined in that directory can be properly
    imported.

    :param module_name: The module's name.
    :param path: The module's path.
    :returns: The loaded module.
    """
    module_parent = str(path.parent)
    sys.path.append(module_parent)

    spec = spec_from_file_location(module_name, path)
    if spec is None:
        raise ImportError(f"could not import {path}")

    module = module_from_spec(spec)
    if spec.loader is None:
        raise ImportError(f"could not load {path}")
    spec.loader.exec_module(module)

    sys.path.remove(module_parent)

    return module
