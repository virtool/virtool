import os
import sys

from virtool.workflow.runtime.hook import Hook

# Autodoc requires the project root to be in the sys.path
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("../"))

# Project information
project = "Virtool"
copyright = "2023, Ian Boyes"
author = "Ian Boyes, Blake Smith"
release = "0.0.0"

# General configuration
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration
sys.path.append(os.path.abspath("../../docs/_ext"))

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
extensions = [
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx_autofixture",
    "sphinx_toolbox.more_autodoc.autoprotocol",
    "sphinx.ext.autosectionlabel",
    "sphinx.ext.intersphinx",
]

# HTML Output Options
html_favicon = "./favicon.ico"
# html_theme = "piccolo_theme"

html_sidebars = {
    "**": ["globaltoc.html", "relations.html", "sourcelink.html", "searchbox.html"]
}

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


def setup_hook_formatting(app, what, name, obj, options, signature, return_annotation):
    if isinstance(obj, Hook):
        return None, None
    return signature, return_annotation


def setup(app):
    app.connect("autodoc-process-signature", setup_hook_formatting)
