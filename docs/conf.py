import os
import sys

# Autodoc requires the project root to be in the sys.path
sys.path.insert(0, os.path.abspath("../"))

# Project information
project = "Virtool"
copyright = "2023, Ian Boyes"
author = "Ian Boyes"

# General configuration
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration
templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
extensions = [
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx_autofixture",
    "sphinx_toolbox.more_autodoc.autoprotocol",
    "sphinx.ext.intersphinx",
]

# HTML Output Options
html_theme = "piccolo_theme"

# Autodoc configuration
autodoc_type_aliases = {"Document": "~virtool.types.Document"}

# Intersphinx configuration
intersphinx_mapping = {
    "virtool": (
        "https://dev.virtool.ca/projects/virtool/en/latest/",
        None,
    ),
    "core": ("https://dev.virtool.ca/projects/virtool-core/en/latest/", None),
    "workflow": (
        "https://dev.virtool.ca/projects/virtool-workflow/en/latest/",
        None,
    ),
}
