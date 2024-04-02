import asyncio

from fastapi import APIRouter
from fastapi.staticfiles import StaticFiles

from lnbits.db import Database
from lnbits.helpers import template_renderer
from lnbits.tasks import catch_everything_and_restart

from .tasks import PaymentsWatcher
from .websocket import WebsocketManager

db = Database("ext_monopoly")

monopoly_static_files = [
    {
        "path": "/monopoly/static",
        "app": StaticFiles(packages=[("lnbits", "extensions/monopoly/static")]),
        "name": "monopoly_static",
    }
]

monopoly_ext: APIRouter = APIRouter(prefix="/monopoly", tags=["monopoly"])

websocketManager = WebsocketManager(db)

def monopoly_renderer():
    return template_renderer(["lnbits/extensions/monopoly/templates"])

from .views import *  # noqa
from .views_api import *  # noqa

def monopoly_start(): # Executed in lnbits app.py for all valid extensions
    paymentsWatcher = PaymentsWatcher(db, websocketManager)
    loop = asyncio.get_event_loop()
    loop.create_task(catch_everything_and_restart(paymentsWatcher.wait_for_paid_invoices))
    loop.create_task(catch_everything_and_restart(paymentsWatcher.wait_for_outgoing_payments))

