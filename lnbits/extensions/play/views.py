from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.params import Depends, Query, Optional
from fastapi.templating import Jinja2Templates
from starlette.responses import HTMLResponse

from lnbits.core.models import User
from lnbits.decorators import check_user_exists

from . import play_ext, difficulty_renderer, websocketManager
from .models import PlayerWalletInfo
from .decorators import require_player_invoice_key
from .crud import (
    validate_ws_authorization_token,
    delete_ws_authorization_token
)

from loguru import logger

templates = Jinja2Templates(directory="templates")

@play_ext.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    user: User = Depends(check_user_exists),
):
    return difficulty_renderer().TemplateResponse(
        "/index.html", {"request": request, "user": user.dict()}
    )

@play_ext.get("/game", response_class=HTMLResponse)
async def game(
    request: Request,
    user: User = Depends(check_user_exists),
    wal: Optional[str] = None,
    open_camera: Optional[str] = None
):
    return difficulty_renderer().TemplateResponse(
        "/game.html", {"request": request, "user": user.dict(), "wallet_id": wal, "open_camera": open_camera}
    )

@play_ext.get("/invite", response_class=HTMLResponse)
async def invite(
    request: Request,
    user: User = Depends(check_user_exists),
    game_id: str = Query(...),
    client_id: str = Query(...),
    invite_voucher: str = Query(...),
):
    invite_vars = {
        "game_id": game_id,
        "client_id": client_id,
        "invite_voucher": invite_voucher,
    }
    return difficulty_renderer().TemplateResponse(
        "/invite.html", {"request": request, "user": user.dict(), "invite_vars": invite_vars}
    )

@play_ext.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    auth_token: str = Query(...),
):
    # Verify and burn authorization token
    authorized = await validate_ws_authorization_token(auth_token)
    assert authorized, "Error: invalid ws authorization token"
    await delete_ws_authorization_token(auth_token)
    # Establish websocket connection with client
    await websocketManager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Client {client_id} says: {data}")

    except WebSocketDisconnect:
        websocketManager.disconnect(client_id)
