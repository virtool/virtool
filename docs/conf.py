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

extensions = ["sphinx.ext.autodoc", "sphinx.ext.intersphinx", "sphinx_autofixture"]

templates_path = ["_templates"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "alabaster"
html_static_path = ["_static"]

# -- Autodoc configuration ---------------------------------------------------

autodoc_type_aliases = {"Document": "~virtool.types.Document"}

# -- Intersphinx configuration -----------------------------------------------

intersphinx_mapping = {
    "pymongo": ("https://pymongo.readthedocs.io/en/stable/", None),
}
