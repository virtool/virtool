from sphinx.addnodes import desc, desc_signature
from sphinx import addnodes
from sphinx.util.inspect import safe_getattr

stage_methods = set()

def get_signature_node(node):
    for child in node.children:
        if isinstance(child, desc_signature):
            return child

    return None

def process_nodes(app, doctree):
    for node in doctree.traverse(desc):
        if node["objtype"] in ("method", "attribute", "function"):
            signature_node = get_signature_node(node)
            name = signature_node["module"] + "." + signature_node["fullname"]

            word = None

            if name in coroutines:
                word = "coroutine"

                if name in exposed:
                    word = "exposed"

                if name in synchronous:
                    word = "synchronous"

                if name in unprotected:
                    word = "unprotected"

                if name in stage_methods:
                    word = "stage method"

            if name in stage_methods:
                word = "stage method"

            if word:
                annotation = addnodes.desc_annotation(
                    word, word, classes=["coroutine"]
                )

                signature_node.insert(0, annotation)


def get_virtool_attr(virtool_class, name, *defargs):
    attr = safe_getattr(virtool_class, name)

    full_name = ".".join([virtool_class.__module__, virtool_class.__name__, name])

    if safe_getattr(attr, "is_stage_method", False):
        stage_methods.add(full_name)

    return attr


def setup(app):
    app.connect("doctree-read", process_nodes)