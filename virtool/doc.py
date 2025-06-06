import ast
import inspect
import warnings
from _ast import (
    AnnAssign,
    Assign,
    AsyncFor,
    AsyncFunctionDef,
    AsyncWith,
    ClassDef,
    For,
    FunctionDef,
    If,
    Name,
    Try,
    While,
    With,
)
from enum import EnumMeta
from textwrap import dedent

from enum_tools.documentation import (
    EnumType,
    MultipleDocstringsWarning,
    _docstring_from_eol_comment,
    _docstring_from_expr,
    _docstring_from_sphinx_comment,
)


def document_enum(an_enum: EnumType) -> EnumType:
    """Document all members of an enum by parsing a docstring from the Python source.

    The docstring can be added in several ways:

    #. A comment at the end the line, starting with ``doc:``:

       .. code-block:: python

           Running = 1  # doc: The system is running.

    #. A comment on the previous line, starting with ``#:``.

       .. code-block:: python

           #: The system is running.
           Running = 1

    #. A string on the line *after* the attribute.
    This can be used for multiline docstrings.

       .. code-block:: python

           Running = 1
           \"\"\"
           The system is running.

           Hello World
           \"\"\"

    If more than one docstring format is found for an enum member
    a :exc:`MultipleDocstringsWarning` is emitted.

    :param an_enum: An :class:`~enum.Enum` subclass
    :type an_enum: :class:`enum.Enum`

    :returns: The same object passed as ``an_enum``.
    This allows this function to be used as a decorator.
    :rtype: :class:`enum.Enum`
    """
    if not isinstance(an_enum, EnumMeta):
        raise TypeError(f"'an_enum' must be an 'Enum', not {type(an_enum)}!")

    func_source = dedent(inspect.getsource(an_enum))
    func_source_tree = ast.parse(func_source)

    module_body = func_source_tree.body[0]
    if isinstance(
        module_body,
        FunctionDef
        | AsyncFunctionDef
        | ClassDef
        | For
        | AsyncFor
        | While
        | If
        | With
        | AsyncWith
        | Try,
    ):
        class_body = module_body.body

        for idx, node in enumerate(class_body):
            targets = []

            if isinstance(node, Assign):
                for t in node.targets:
                    if isinstance(t, Name):
                        targets.append(t.id)

            elif isinstance(node, AnnAssign):
                if isinstance(node.target, Name):
                    targets.append(node.target.id)
            else:
                continue

            if idx + 1 == len(class_body):
                next_node = None
            else:
                next_node = class_body[idx + 1]

            docstring_candidates = []

            if isinstance(next_node, ast.Expr):
                # might be docstring
                docstring_candidates.append(_docstring_from_expr(next_node))

            if isinstance(node, Assign | AnnAssign):
                # maybe no luck with """ docstring? look for EOL comment.
                docstring_candidates.append(
                    _docstring_from_eol_comment(func_source, node)
                )

                # check non-whitespace lines above for Sphinx-style comment.
                docstring_candidates.append(
                    _docstring_from_sphinx_comment(func_source, node)
                )

            docstring_candidates_nn = list(filter(None, docstring_candidates))
            if len(docstring_candidates_nn) > 1:
                # Multiple docstrings found, warn
                warnings.warn(
                    MultipleDocstringsWarning(
                        getattr(an_enum, targets[0]), docstring_candidates_nn
                    )
                )

            if docstring_candidates_nn:
                docstring = docstring_candidates_nn[0]

                for target in targets:
                    getattr(an_enum, target).__doc__ = docstring

    return an_enum
