from fastapi import APIRouter
from fastapi.staticfiles import StaticFiles

from lnbits.db import Database
from lnbits.helpers import template_renderer

db = Database("ext_monopoly")

monopoly_static_files = [
    {
        "path": "/monopoly/static",
        "app": StaticFiles(packages=[("lnbits", "extensions/monopoly/static")]),
        "name": "monopoly_static",
    }
]

monopoly_ext: APIRouter = APIRouter(prefix="/monopoly", tags=["monopoly"])

def monopoly_renderer():
    return template_renderer(["lnbits/extensions/monopoly/templates"])

from .views import *  # noqa
from .views_api import *  # noqa
