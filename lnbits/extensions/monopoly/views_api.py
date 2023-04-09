# views_api.py is for you API endpoints that could be hit by another service

# add your dependencies here

# import httpx
# (use httpx just like requests, except instead of response.ok there's only the
#  response.is_error that is its inverse)
import os
from http import HTTPStatus
from starlette.responses import RedirectResponse
from starlette.requests import Request
from loguru import logger
from . import monopoly_ext
from .crud import (
    create_game,
    create_player,
    create_player_wallet,
    update_first_player_name,
    invite_player,
    update_bank_balance,
    update_game_funding,
    start_game,
    update_game_voucher,
    update_game_pay_link,
    update_game_invoice,
    update_player_balance,
    get_game,
    get_bank_balance,
    get_game_started,
    get_game_with_pay_link,
    get_game_with_invoice,
    get_player_balance,
    get_players,
    get_players_count,
    get_max_players_count,
    pick_player_name
)
from lnbits.core.crud import update_user_extension
from .models import CreateGameData, CreateFirstPlayerData, UpdateFirstPlayerData, UpdateFirstPlayerName, UpdateBankBalanceData, UpdateGameFundingData, StartGameData, UpdateGameVoucherData, UpdateGamePayLinkData, UpdateGameInvoiceData, CreatePlayerData, UpdatePlayerBalance

# Setters
@monopoly_ext.post("/api/v1/games", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_create(data: CreateGameData):
    game = await create_game(data)
    return game

@monopoly_ext.post("/api/v1/player", status_code=HTTPStatus.CREATED)
async def api_monopoly_first_player_create(data: CreateFirstPlayerData):
    # Create player wallet
    created_wallet = await create_player_wallet(data)
    logger.info(f"Created player wallet ({created_wallet.id})")
    return created_wallet

@monopoly_ext.put("/api/v1/player", status_code=HTTPStatus.CREATED)
async def api_monopoly_first_player_update(data: UpdateFirstPlayerData):
    # Create player wallet
    player_wallet_name = await pick_player_name(data.bank_id)
    walletData = UpdateFirstPlayerName(
        player_wallet_id=data.player_wallet_id,
        player_wallet_name=player_wallet_name
    )
    updated_wallet = await update_first_player_name(walletData)
    logger.info(f"Updated player name for {player_wallet_name} ({updated_wallet.id})")
    return updated_wallet

@monopoly_ext.put("/api/v1/games/bank-balance", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_bank_balance(data: UpdateBankBalanceData):
    balance = await update_bank_balance(data)
    return balance

@monopoly_ext.put("/api/v1/games/funding", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_game_funding(data: UpdateGameFundingData):
    funding = await update_game_funding(data)
    return funding

@monopoly_ext.put("/api/v1/games/start", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_start_game(data: StartGameData):
    started = await start_game(data)
    return started

@monopoly_ext.post("/api/v1/games/voucher", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_voucher(data: UpdateGameVoucherData):
    voucher = await update_game_voucher(data)
    return voucher

@monopoly_ext.post("/api/v1/games/paylink", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_paylink(data: UpdateGamePayLinkData):
    payLink = await update_game_pay_link(data)
    return payLink

@monopoly_ext.post("/api/v1/games/invoice", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_invoice(data: UpdateGameInvoiceData):
    invoice = await update_game_invoice(data)
    return invoice

@monopoly_ext.post("/api/v1/players", status_code=HTTPStatus.CREATED)
async def api_monopoly_players_create(data: CreatePlayerData):
    player = await create_player(data)
    return player

@monopoly_ext.put("/api/v1/players/balance", status_code=HTTPStatus.CREATED)
async def api_monopoly_players_update_balance(data: UpdatePlayerBalance):
    player = await update_player_balance(data)
    return player

# Getters
@monopoly_ext.get("/api/v1/games", status_code=HTTPStatus.OK)
async def api_monopoly_games(bank_id: str):
    return [game for game in await get_game(bank_id)]

@monopoly_ext.get("/api/v1/bank-balance", status_code=HTTPStatus.OK)
async def api_monopoly_bank_balance(bank_id: str):
    return [balance for balance in await get_bank_balance(bank_id)]

@monopoly_ext.get("/api/v1/game-started", status_code=HTTPStatus.OK)
async def api_monopoly_game_started(bank_id: str):
    return [started for started in await get_game_started(bank_id)]

@monopoly_ext.get("/api/v1/game_with_pay_link", status_code=HTTPStatus.OK)
async def api_monopoly_game_with_pay_link(bank_id: str):
    return [game for game in await get_game_with_pay_link(bank_id)]

@monopoly_ext.get("/api/v1/game_with_invoice", status_code=HTTPStatus.OK)
async def api_monopoly_game_with_invoice(bank_id: str):
    return [game for game in await get_game_with_invoice(bank_id)]

@monopoly_ext.get("/api/v1/players", status_code=HTTPStatus.OK)
async def api_monopoly_players(bank_id: str):
    return [player for player in await get_players(bank_id)]

@monopoly_ext.get("/api/v1/players/balance", status_code=HTTPStatus.OK)
async def api_monopoly_player_balance(player_wallet_id: str):
    return await get_player_balance(player_wallet_id)

@monopoly_ext.get("/api/v1/player_name", status_code=HTTPStatus.OK)
async def api_monopoly_player_name(bank_id: str):
    return await pick_player_name(bank_id)

@monopoly_ext.get("/api/v1/invite", status_code=HTTPStatus.OK)
async def api_monopoly_players_invite(
    game_id: str,
    voucher: str,
    request: Request
):
    # Make sure all expected players have not joined yet
    current_players_count = await get_players_count(game_id)
    max_players_count = await get_max_players_count(game_id)
    assert current_players_count[0] < max_players_count[0], "Maximum number of players has been reached"
    # Create player account and wallet
    invited_user_name = await pick_player_name(game_id)
    invited_user_id = await invite_player(game_id, invited_user_name)
    logger.info(f"Created account and wallet for {invited_user_name} ({invited_user_id})")
    # Enable monopoly extension for player
    logger.info(f"Enabling extension: monopoly for {invited_user_name} ({invited_user_id})")
    await update_user_extension(user_id=invited_user_id, extension="monopoly", active=True)
    # Redirect
    redirectUrl = request.url._url.split("monopoly/api/v1/")[0] + "monopoly/invite?usr=" + invited_user_id + "&game_id=" + game_id +"&voucher=" + voucher
    return RedirectResponse(redirectUrl)
