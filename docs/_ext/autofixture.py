import inspect
import re
from typing import Any

import pyfixtures
from docutils.parsers.rst import directives
from sphinx import addnodes
from sphinx.domains.python import PyFunction, PyObject
from sphinx.ext.autodoc import FunctionDocumenter
from sphinx.util import nodes
from sphinx.util.typing import OptionSpec


class FixtureDirective(PyFunction):
    option_spec: OptionSpec = PyObject.option_spec.copy()

    option_spec.update(
        {
            "async": directives.flag,
            "protocol": directives.flag,
        }
    )

    def get_signature_prefix(self, sig: str) -> list[nodes.Node]:
        return [addnodes.desc_sig_keyword("", "fixture"), addnodes.desc_sig_space()]

    def needs_arglist(self) -> bool:
        return True


class FixtureDocumenter(FunctionDocumenter):
    objtype = "fixture"
    directivetype = "fixture"
    priority = 10 + FunctionDocumenter.priority

    @classmethod
    def can_document_member(
        cls, member: Any, membername: str, isattr: bool, parent: Any
    ) -> bool:
        return isinstance(member, pyfixtures.Fixture)

    def format_args(self, **kwargs: Any) -> str:
        args = super(FixtureDocumenter, self).format_args(**kwargs)
        args = re.sub("\(.*?\)", "(...)", args)

        if self.object.__return_protocol__ is not None:
            if "->" not in args:
                args = args + " -> "

            if inspect.iscoroutinefunction(self.object.__return_protocol__.__call__):
                async_prefix = "async "
            else:
                async_prefix = ""

            args = re.sub(
                "->.*$",
                f"-> {async_prefix}{inspect.signature(self.object.__return_protocol__.__call__)}",
                args,
            )

        return args


def add_protocol_signatures(app, what, name, obj, options, lines):
    """Add the signature of the protocol __call__ to the docstring"""
    if what == "fixture" and obj.__return_protocol__ is not None:
        doc = inspect.getdoc(obj.__return_protocol__.__call__)

        lines.clear()
        lines.extend(doc.split("\n"))


def setup(app):
    app.setup_extension("sphinx.ext.autodoc")  # Require autodoc extension
    app.add_autodocumenter(FixtureDocumenter)
    app.add_directive("py:fixture", FixtureDirective)
    app.connect("autodoc-process-docstring", add_protocol_signatures)

    return {
        "version": "0.1",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }
