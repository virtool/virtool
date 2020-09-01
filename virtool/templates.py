import jinja2


setup_template_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader("./templates"),
    autoescape=True
)

