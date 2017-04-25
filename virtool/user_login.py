import random

from aiohttp import web
from mako.template import Template
from virtool.utils import random_alphanumeric


def get_login_template():
    return Template(filename="virtool/templates/login.html")


def generate_verification_keys():
    keys = list()

    for i in range(3):
        key = random.choice(["", random_alphanumeric(12, mixed_case=True)])
        keys.append(key)

    return keys


async def login_handler(req):
    form_data = await req.post()

    username = form_data.get("username", None)
    password = form_data.get("username", None)

    key_one = form_data.get("login-1", "")
    key_two = form_data.get("login-2", "")
    key_three = form_data.get("login-3", "")

    return web.HTTPFound("/")


login_template = Template(filename="virtool/templates/login.html")
