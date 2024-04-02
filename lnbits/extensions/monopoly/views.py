from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.params import Depends, Query, Optional
from fastapi.templating import Jinja2Templates
from starlette.responses import HTMLResponse

from lnbits.core.models import User
from lnbits.decorators import check_user_exists

from . import monopoly_ext, monopoly_renderer, websocketManager

from loguru import logger

templates = Jinja2Templates(directory="templates")

@monopoly_ext.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    user: User = Depends(check_user_exists),
):
    return monopoly_renderer().TemplateResponse(
        "monopoly/index.html", {"request": request, "user": user.dict()}
    )

@monopoly_ext.get("/game", response_class=HTMLResponse)
async def game(
    request: Request,
    user: User = Depends(check_user_exists),
    wal: Optional[str] = None,
    open_camera: Optional[str] = None
):
    return monopoly_renderer().TemplateResponse(
        "monopoly/game.html", {"request": request, "user": user.dict(), "wallet_id": wal, "open_camera": open_camera}
    )

@monopoly_ext.get("/invite", response_class=HTMLResponse)
async def invite(
    request: Request,
    user: User = Depends(check_user_exists),
    game_id: str = Query(...),
    client_id: str = Query(...),
    invite_voucher: str = Query(...),
    reward_voucher: str = Query(...),
):
    invite_vars = {
        "game_id": game_id,
        "client_id": client_id,
        "invite_voucher": invite_voucher,
        "reward_voucher": reward_voucher,
    }
    return monopoly_renderer().TemplateResponse(
        "monopoly/invite.html", {"request": request, "user": user.dict(), "invite_vars": invite_vars}
    )

@monopoly_ext.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocketManager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Client {client_id} says: {data}")

    except WebSocketDisconnect:
        websocketManager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
