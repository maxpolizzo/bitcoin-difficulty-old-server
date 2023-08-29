from fastapi import FastAPI, Request
from fastapi.params import Depends, Query
from fastapi.templating import Jinja2Templates
from starlette.responses import HTMLResponse

from lnbits.core.models import User
from lnbits.decorators import check_user_exists

from . import monopoly_ext, monopoly_renderer

templates = Jinja2Templates(directory="templates")

@monopoly_ext.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    user: User = Depends(check_user_exists),  # type: ignore
):
    return monopoly_renderer().TemplateResponse(
        "monopoly/index.html", {"request": request, "user": user.dict()}
    )

@monopoly_ext.get("/game", response_class=HTMLResponse)
async def index(
    request: Request,
    user: User = Depends(check_user_exists),  # type: ignore
    game_id: str = Query(...),
):
    return monopoly_renderer().TemplateResponse(
        "monopoly/game.html", {"request": request, "user": user.dict(), "game_id": game_id}
    )

@monopoly_ext.get("/invite", response_class=HTMLResponse)
async def invite(
    request: Request,
    user: User = Depends(check_user_exists),  # type: ignore
    game_id: str = Query(...),
    invite_voucher: str = Query(...),
    reward_voucher: str = Query(...),
):
    invite_vars = {
        "game_id": game_id,
        "invite_voucher": invite_voucher,
        "reward_voucher": reward_voucher,
    }
    return monopoly_renderer().TemplateResponse(
        "monopoly/invite.html", {"request": request, "user": user.dict(), "invite_vars": invite_vars}
    )
