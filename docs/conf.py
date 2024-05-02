import os
import sys


#  -- Autodoc configuration ---------------------------------------------------
# Note:

# For Sphinx (actually, the Python interpreter that executes Sphinx) to find your module, it must be importable. That means that the module or the package must be in one of the directories on sys.path - adapt your sys.path in the configuration file accordingly.

# Autodoc requires the project root to be in the sys.path
sys.path.insert(0, os.path.abspath("../"))

# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "Virtool"
copyright = "2023, Ian Boyes"
author = "Ian Boyes"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    "sphinx.ext.autodoc",
    "sphinx_autodoc_typehints",
    "sphinx.ext.intersphinx",
    "sphinx_autofixture",
    "sphinx_toolbox.more_autodoc.autoprotocol",
]

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "piccolo_theme"
# html_theme_options = {
#     "page_width": "1200px",
# }
# html_static_path = ["_static"]

# -- Autodoc configuration ---------------------------------------------------

autodoc_type_aliases = {"Document": "~virtool.types.Document"}

# -- Intersphinx configuration -----------------------------------------------

intersphinx_mapping = {
    "pymongo": ("https://pymongo.readthedocs.io/en/stable/", None),
}
