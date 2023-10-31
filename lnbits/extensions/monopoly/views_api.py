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
    update_market_liquidity,
    update_game_funding,
    start_game,
    update_invite_voucher,
    update_reward_voucher,
    update_game_pay_link,
    update_game_invoice,
    update_player_balance,
    get_game,
    get_market_liquidity,
    get_game_started,
    get_game_with_pay_link,
    get_game_with_invoice,
    get_player_balance,
    get_players,
    get_players_count,
    get_max_players_count,
    pick_player_name,
    get_properties,
    register_property,
    get_property,
    update_property_owner,
    update_property_income,
    upgrade_property,
    initialize_cards_indexes,
    update_next_card_index,
    get_next_chance_card_index,
    get_next_community_chest_card_index,
    update_cumulated_fines,
    get_cumulated_fines,
    reset_cumulated_fines,
    update_player_pay_link,
    get_player_pay_link
)
from lnbits.core.crud import update_user_extension
from .models import CreateGameData, CreateFirstPlayerData, UpdateFirstPlayerData, UpdateFirstPlayerName, UpdateMarketLiquidityData, UpdateGameFundingData, StartGameData, UpdateVoucherData, UpdateGamePayLinkData, UpdateGameInvoiceData, CreatePlayerData, UpdatePlayerBalance, Property, UpdatePropertyOwner, UpdatePropertyIncome, UpgradeProperty, InitCardsIndex, UpdateCardIndex, UpdateCumulatedFines, ResetCumulatedFines, UpdatePlayerPayLink, PlayerPayLink

# Setters
@monopoly_ext.post("/api/v1/games", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_create(data: CreateGameData):
    game = await create_game(data)
    return game

@monopoly_ext.post("/api/v1/player", status_code=HTTPStatus.CREATED)
async def api_monopoly_first_player_create(data: CreateFirstPlayerData):
    # Create player wallet
    player_created = await create_player_wallet(data)
    logger.info(f"Created player and player wallet ({player_created.player_index} {player_created.player_wallet_id})")
    return player_created

@monopoly_ext.put("/api/v1/player", status_code=HTTPStatus.CREATED)
async def api_monopoly_first_player_update(data: UpdateFirstPlayerData):
    # Create player wallet
    player_wallet_name = await pick_player_name(data.game_id)
    walletData = UpdateFirstPlayerName(
        player_wallet_id=data.player_wallet_id,
        player_wallet_name=player_wallet_name
    )
    updated_wallet = await update_first_player_name(walletData)
    logger.info(f"Updated player name for {player_wallet_name} ({updated_wallet.id})")
    return updated_wallet

@monopoly_ext.put("/api/v1/games/market-liquidity", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_market_liquidity(data: UpdateMarketLiquidityData):
    balance = await update_market_liquidity(data)
    return balance

@monopoly_ext.put("/api/v1/games/funding", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_game_funding(data: UpdateGameFundingData):
    funding = await update_game_funding(data)
    return funding

@monopoly_ext.put("/api/v1/games/start", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_start_game(data: StartGameData):
    started = await start_game(data)
    return started

@monopoly_ext.post("/api/v1/games/invite_voucher", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_invite_voucher(data: UpdateVoucherData):
    voucher = await update_invite_voucher(data)
    return voucher

@monopoly_ext.post("/api/v1/games/reward_voucher", status_code=HTTPStatus.CREATED)
async def api_monopoly_games_update_reward_voucher(data: UpdateVoucherData):
    voucher = await update_reward_voucher(data)
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

@monopoly_ext.put("/api/v1/players/pay_link", status_code=HTTPStatus.CREATED)
async def api_monopoly_players_update_pay_link(data: UpdatePlayerPayLink):
    updated_player_pay_link = await update_player_pay_link(data)
    return update_player_pay_link

@monopoly_ext.post("/api/v1/property", status_code=HTTPStatus.CREATED)
async def api_monopoly_property_register(data: Property):
    property = await register_property(data)
    return property

@monopoly_ext.put("/api/v1/property/transfer-ownership", status_code=HTTPStatus.CREATED)
async def api_monopoly_property_transfer_ownership(data: UpdatePropertyOwner):
    property = await update_property_owner(data)
    return property

@monopoly_ext.put("/api/v1/property/upgrade", status_code=HTTPStatus.CREATED)
async def api_monopoly_property_upgrade(data: UpgradeProperty):
    property = await upgrade_property(data)
    return property

@monopoly_ext.put("/api/v1/property/update-income", status_code=HTTPStatus.CREATED)
async def api_monopoly_property_update_income(data: UpdatePropertyIncome):
    property = await update_property_income(data)
    return property

@monopoly_ext.post("/api/v1/cards/init_cards_indexes", status_code=HTTPStatus.CREATED)
async def api_monopoly_init_cards_indexes(data: InitCardsIndex):
    await initialize_cards_indexes(data)

@monopoly_ext.put("/api/v1/cards/update_next_card_index", status_code=HTTPStatus.CREATED)
async def api_monopoly_update_next_card_index(data: UpdateCardIndex):
    updated_next_card_index = await update_next_card_index(data)
    return updated_next_card_index

@monopoly_ext.put("/api/v1/cards/update_cumulated_fines", status_code=HTTPStatus.CREATED)
async def api_monopoly_update_cumulated_fines(data: UpdateCumulatedFines):
    updated_cumulated_fines = await update_cumulated_fines(data)
    return updated_cumulated_fines

@monopoly_ext.put("/api/v1/cards/reset_cumulated_fines", status_code=HTTPStatus.CREATED)
async def api_monopoly_reset_cumulated_fines(data: ResetCumulatedFines):
    cumulated_fines_reset = await reset_cumulated_fines(data)
    return cumulated_fines_reset

# Getters
@monopoly_ext.get("/api/v1/games", status_code=HTTPStatus.OK)
async def api_monopoly_games(game_id: str):
    return [game for game in await get_game(game_id)]

@monopoly_ext.get("/api/v1/market-liquidity", status_code=HTTPStatus.OK)
async def api_monopoly_market_liquidity(game_id: str):
    return [balance for balance in await get_market_liquidity(game_id)]

@monopoly_ext.get("/api/v1/game-started", status_code=HTTPStatus.OK)
async def api_monopoly_game_started(game_id: str):
    return [started for started in await get_game_started(game_id)]

@monopoly_ext.get("/api/v1/game_with_pay_link", status_code=HTTPStatus.OK)
async def api_monopoly_game_with_pay_link(game_id: str):
    return [game for game in await get_game_with_pay_link(game_id)]

@monopoly_ext.get("/api/v1/game_with_invoice", status_code=HTTPStatus.OK)
async def api_monopoly_game_with_invoice(game_id: str):
    return [game for game in await get_game_with_invoice(game_id)]

@monopoly_ext.get("/api/v1/players", status_code=HTTPStatus.OK)
async def api_monopoly_players(game_id: str):
    return [player for player in await get_players(game_id)]

@monopoly_ext.get("/api/v1/players/balance", status_code=HTTPStatus.OK)
async def api_monopoly_player_balance(player_wallet_id: str):
    return await get_player_balance(player_wallet_id)

@monopoly_ext.get("/api/v1/players/pay_link", status_code=HTTPStatus.OK)
async def api_monopoly_player_pay_link(player_wallet_id: str):
    return await get_player_pay_link(player_wallet_id)

@monopoly_ext.get("/api/v1/player_name", status_code=HTTPStatus.OK)
async def api_monopoly_player_name(game_id: str):
    return await pick_player_name(game_id)

@monopoly_ext.get("/api/v1/property", status_code=HTTPStatus.OK)
async def api_monopoly_properties(game_id: str, property_color: str, property_id: int):
    return await get_property(game_id, property_color, property_id)

@monopoly_ext.get("/api/v1/properties", status_code=HTTPStatus.OK)
async def api_monopoly_properties(game_id: str):
    return [property for property in await get_properties(game_id)]

@monopoly_ext.get("/api/v1/next_chance_card_index", status_code=HTTPStatus.OK)
async def api_monopoly_next_chance_card_index(game_id: str):
    return await get_next_chance_card_index(game_id)

@monopoly_ext.get("/api/v1/next_community_chest_card_index", status_code=HTTPStatus.OK)
async def api_monopoly_next_community_chest_card_index(game_id: str):
    return await get_next_community_chest_card_index(game_id)

@monopoly_ext.get("/api/v1/cumulated_fines", status_code=HTTPStatus.OK)
async def api_monopoly_cumulated_fines(game_id: str):
    return await get_cumulated_fines(game_id)

@monopoly_ext.get("/api/v1/invite", status_code=HTTPStatus.OK)
async def api_monopoly_players_invite(
    game_id: str,
    invite_voucher: str,
    reward_voucher: str,
    request: Request
):
    # Make sure all expected players have not joined yet
    current_players_count = await get_players_count(game_id)
    max_players_count = await get_max_players_count(game_id)
    assert current_players_count[0] < max_players_count[0], "Maximum number of players has been reached"
    # Create player account and wallet
    invited_user_name = await pick_player_name(game_id)
    invited_player = await invite_player(game_id, invited_user_name)
    logger.info(f"Created account and wallet for {invited_user_name} ({invited_player.player_user_id})")
    # Enable monopoly extension for player
    logger.info(f"Enabling extension: monopoly for {invited_user_name} ({invited_player.player_user_id})")
    await update_user_extension(user_id=invited_player.player_user_id, extension="monopoly", active=True)
    # Redirect
    redirectUrl = request.url._url.split("monopoly/api/v1/")[0] + "monopoly/invite?usr=" + invited_player.player_user_id + "&player_index=" + invited_player.player_index + "&game_id=" + game_id + "&invite_voucher=" + invite_voucher+ "&reward_voucher=" + reward_voucher
    return RedirectResponse(redirectUrl)
