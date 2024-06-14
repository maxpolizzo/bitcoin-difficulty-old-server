import asyncio

from fastapi import APIRouter
from fastapi.staticfiles import StaticFiles

from lnbits.db import Database
from lnbits.helpers import template_renderer
from lnbits.tasks import catch_everything_and_restart

from .tasks import PaymentsWatcher
from .websocket import WebsocketManager

play_static_files = [
    {
        "path": "/play/static",
        "app": StaticFiles(packages=[("lnbits", "extensions/play/static")]),
        "name": "play_static",
    }
]

play_ext: APIRouter = APIRouter(prefix="/play", tags=["play"])

db = Database("ext_difficulty")

websocketManager = WebsocketManager(db)

def difficulty_renderer():
    return template_renderer(["lnbits/extensions/play/templates/difficulty"])

from .views import *  # noqa
from .views_api import *  # noqa

def play_start(): # Executed in lnbits app.py for all valid extensions
    paymentsWatcher = PaymentsWatcher(db, websocketManager)
    loop = asyncio.get_event_loop()
    loop.create_task(catch_everything_and_restart(paymentsWatcher.wait_for_paid_invoices))
    loop.create_task(catch_everything_and_restart(paymentsWatcher.wait_for_outgoing_payments))

