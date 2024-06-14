import os
from http import HTTPStatus
from starlette.responses import RedirectResponse
from starlette.requests import Request
from loguru import logger
from fastapi import (
    Depends,
    HTTPException
)
from lnbits.core.crud import update_user_extension
from lnbits.decorators import (
    require_admin_key,
    require_invoice_key,
    WalletTypeInfo
)
from . import play_ext
from .decorators import (
    require_player_invoice_key,
    require_player_admin_key,
    require_player_wallet_invoice_key,
    require_player_index_invoice_key,
    require_game_creator_admin_key
)
from .crud import (
    create_game,
    get_game,
    create_free_market_wallet,
    update_wallet_pay_link,
    update_free_market_liquidity,
    get_free_market_liquidity,
    update_game_funding,
    get_player_wallet_info,
    get_wallets_info,
    create_first_player,
    get_player,
    is_active_player,
    get_active_players,
    get_active_players_count,
    get_max_players_count,
    create_invite_voucher,
    get_game_started,
    get_game_time,
    get_player_turn,
    get_properties,
    get_game_invite,
    invite_player,
    deactivate_player,
    join_game,
    initialize_cards,
    pick_card,
    start_game,
    increment_player_turn,
    register_property,
    transfer_property_ownership,
    get_player_pay_link,
    get_property,
    update_property_income,
    upgrade_property_miners,
    provide_pow,
    update_cumulated_fines,
    get_cumulated_fines,
    claim_cumulated_fines,
    claim_card_reward,
    create_ws_authorization_token
)
from .models import (
    Game,
    CreateGame,
    GameId,
    GameAdminUserId,
    RegisterWalletPayLink,
    UpdateFreeMarketLiquidity,
    PlayerWallet,
    PlayerWalletInfo,
    CreateFirstPlayer,
    UpdateWalletBalance,
    CreateVoucher,
    UpdateGameFunding,
    JoinGame,
    InitializeCards,
    PickCard,
    PlayerIndex,
    GetPayLink,
    Property,
    UpdatePropertyIncome,
    UpgradeMiners,
    UpdateCumulatedFines,
    RewardClaim
)

# Setters
@play_ext.post("/api/v1/ws-auth-token", status_code=HTTPStatus.OK)
async def api_ws_auth_token(
    data: GameId,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    return await create_ws_authorization_token()

@play_ext.post("/api/v1/game", status_code=HTTPStatus.CREATED)
async def api_difficulty_create_game(
    data: CreateGame,
    walletInfo: WalletTypeInfo = Depends(require_admin_key)
 ):
    game = await create_game(data, walletInfo.wallet.user)
    return game

@play_ext.post("/api/v1/wallet/free-market", status_code=HTTPStatus.CREATED)
async def api_difficulty_create_free_market_wallet(
    data: GameId,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    # Create free market wallet
    free_market_wallet = await create_free_market_wallet(data, game_admin_user_id.admin_user_id)
    logger.info(f"Created free market wallet for game {data.game_id}")
    return free_market_wallet

@play_ext.put("/api/v1/wallet/pay-link", status_code=HTTPStatus.CREATED)
async def api_difficulty_update_wallet_pay_link(
    data: RegisterWalletPayLink,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_wallet_invoice_key)
):
    # Register wallet pay link
    payLink = await update_wallet_pay_link(data)
    return payLink

@play_ext.put("/api/v1/game/free-market-liquidity", status_code=HTTPStatus.CREATED)
async def api_difficulty_update_free_market_liquidity(
    data: UpdateFreeMarketLiquidity,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    # Update free market liquidity
    await update_free_market_liquidity(data)

@play_ext.post("/api/v1/player", status_code=HTTPStatus.CREATED)
async def api_difficulty_create_first_player_wallet(
    data: CreateFirstPlayer,
    game_admin_user_id: Game = Depends(require_game_creator_admin_key)
):
    # Create first player
    first_player = await create_first_player(data)
    logger.info(f"Created first player")
    return first_player

@play_ext.put("/api/v1/game/funding", status_code=HTTPStatus.CREATED)
async def api_difficulty_update_game_funding(
    data: UpdateGameFunding,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    await update_game_funding(data)

@play_ext.post("/api/v1/game/invite-voucher", status_code=HTTPStatus.CREATED)
async def api_difficulty_create_invite_voucher(
    data: CreateVoucher,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    await create_invite_voucher(data)

# Here we do not require any authentication since invited player does not yet have an LNBits account
@play_ext.get("/api/v1/invite", status_code=HTTPStatus.OK)
async def api_difficulty_player_invite(
    game_id: str,
    invite_voucher: str,
    request: Request
):
    # Make sure all expected players have not joined yet
    current_players_count = await get_active_players_count(game_id)
    max_players_count = await get_max_players_count(game_id)
    assert current_players_count[0] < max_players_count[0], "Maximum number of players has been reached for this game"
    # Create player account and wallet
    invited_player = await invite_player(game_id)
    logger.info(f"Created account and wallet for {invited_player.name} ({invited_player.id})")
    # Enable extension for player
    logger.info(f"Enabling extension for {invited_player.name} ({invited_player.id})")
    await update_user_extension(user_id=invited_player.id, extension="play", active=True)
    # Redirect
    redirectUrl = request.url._url.split("play/api/v1/")[0] + "play/invite?usr=" + invited_player.id + "&game_id=" + game_id + "&client_id=" + invited_player.client_id + "&invite_voucher=" + invite_voucher
    return RedirectResponse(redirectUrl)

# Here we can only require a valid invoice key because Player has not been not created yet
@play_ext.post("/api/v1/join-game", status_code=HTTPStatus.OK)
async def api_difficulty_join_game(
    data: JoinGame,
    playerWalletInfo: PlayerWalletInfo = Depends(require_invoice_key)
):
    # Make sure all expected players have not joined yet
    players_count = await get_active_players_count(data.game_id)
    max_players_count = await get_max_players_count(data.game_id)
    assert players_count[0] < max_players_count[0], "Maximum number of players has been reached for this game"
    player = await join_game(
        JoinGame(
            game_id=data.game_id,
            client_id=data.client_id,
            user_id=data.user_id,
            wallet_id=data.wallet_id,
            player_index=str(players_count[0] + 1),
            player_name=data.player_name
        )
    )
    return player

@play_ext.post("/api/v1/players/deactivate-player", status_code=HTTPStatus.CREATED)
async def api_difficulty_deactivate_player(
    data: PlayerIndex,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    await deactivate_player(data)

@play_ext.post("/api/v1/cards/initialize-cards", status_code=HTTPStatus.CREATED)
async def api_difficulty_initialize_cards(
    data: InitializeCards,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    await initialize_cards(data)

@play_ext.post("/api/v1/cards/pick-card", status_code=HTTPStatus.CREATED)
async def api_difficulty_pick_card(
    data: PickCard,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    card_id = await pick_card(data)
    if (card_id == "already_picked"):
        error_msg = "Player already picked a card in this turn"
        raise HTTPException(
            status_code=401,
            detail=error_msg,
            headers={"X-Error": error_msg},
         )
    else:
        return card_id

@play_ext.put("/api/v1/start-game", status_code=HTTPStatus.CREATED)
async def api_difficulty_start_game(
    data: GameId,
    game_admin_user_id: GameAdminUserId = Depends(require_game_creator_admin_key)
):
    return await start_game(data)

@play_ext.put("/api/v1/game/next_player_turn", status_code=HTTPStatus.CREATED)
async def api_difficulty_next_player_turn(
    data: PlayerIndex,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    player_turn = await increment_player_turn(data)
    return player_turn

@play_ext.post("/api/v1/property", status_code=HTTPStatus.CREATED)
async def api_difficulty_register_property(
    data: Property,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await register_property(data)

@play_ext.put("/api/v1/transfer-property-ownership", status_code=HTTPStatus.CREATED)
async def api_difficulty_transfer_property_ownership(
    data: Property,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await transfer_property_ownership(data)

@play_ext.put("/api/v1/update-property-income", status_code=HTTPStatus.CREATED)
async def api_difficulty_update_property_income(
    data: UpdatePropertyIncome,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    return await update_property_income(data)

@play_ext.put("/api/v1/upgrade-property-miners", status_code=HTTPStatus.CREATED)
async def api_difficulty_upgrade_property_miners(
    data: UpgradeMiners,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    new_mining_capacity = await upgrade_property_miners(data)
    return new_mining_capacity

@play_ext.put("/api/v1/provide_pow", status_code=HTTPStatus.CREATED)
async def api_difficulty_provide_pow(
    data: PlayerIndex,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await provide_pow(data)

@play_ext.put("/api/v1/update_cumulated_fines", status_code=HTTPStatus.CREATED)
async def api_difficulty_update_cumulated_fines(
    data: UpdateCumulatedFines,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await update_cumulated_fines(data)

@play_ext.put("/api/v1/claim_cumulated_fines", status_code=HTTPStatus.CREATED)
async def api_difficulty_claim_cumulated_fines(
    data: PlayerIndex,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await claim_cumulated_fines(data)

@play_ext.put("/api/v1/claim_card_reward", status_code=HTTPStatus.CREATED)
async def api_difficulty_claim_card_reward(
    data: RewardClaim,
    playerWalletInfo: PlayerWalletInfo = Depends(require_player_index_invoice_key)
):
    await claim_card_reward(data)

# Getters
@play_ext.get("/api/v1/game", status_code=HTTPStatus.OK)
async def api_difficulty_game(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_game(game_id)

# Here we do not require any authentication token in order to allow deactivated player to call
@play_ext.get("/api/v1/game-time", status_code=HTTPStatus.OK)
async def api_difficulty_game(
    game_id: str
):
    return await get_game_time(game_id)

@play_ext.get("/api/v1/free-market-liquidity", status_code=HTTPStatus.OK)
async def api_difficulty_free_market_liquidity(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_free_market_liquidity(game_id)

@play_ext.get("/api/v1/wallet", status_code=HTTPStatus.OK)
async def api_difficulty_wallet(
    wallet_id: str,
    player_wallet: PlayerWallet = Depends(require_player_admin_key)
):
    return player_wallet

@play_ext.get("/api/v1/wallet-info", status_code=HTTPStatus.OK)
async def api_difficulty_wallet_info(
    game_id: str,
    wallet_id: str,
    player_apikey_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_player_wallet_info(wallet_id)

@play_ext.get("/api/v1/wallets-info", status_code=HTTPStatus.OK)
async def api_difficulty_wallet_info(
    game_id: str,
    player_apikey_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_wallets_info(game_id)

@play_ext.get("/api/v1/game-started", status_code=HTTPStatus.OK)
async def api_difficulty_game_started(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return [game_started for game_started in await get_game_started(game_id)]

# Here we do not require any authentication token in order to allow deactivated player to call
@play_ext.get("/api/v1/player", status_code=HTTPStatus.OK)
async def api_difficulty_players(
    game_id: str,
    player_index: str,
):
    return await get_player(game_id, player_index)

@play_ext.get("/api/v1/players", status_code=HTTPStatus.OK)
async def api_difficulty_players(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return [player for player in await get_active_players(game_id)]

@play_ext.get("/api/v1/player_turn", status_code=HTTPStatus.OK)
async def api_difficulty_player_turn(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    player_turn = await get_player_turn(game_id)
    return player_turn

@play_ext.get("/api/v1/properties", status_code=HTTPStatus.OK)
async def api_difficulty_properties(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return [property for property in await get_properties(game_id)]

# Here we can only require a valid invoice key because Player has not been created yet (called on invite)
@play_ext.get("/api/v1/game_invite", status_code=HTTPStatus.OK)
async def api_difficulty_game_invite(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_invoice_key)
):
    game_invite = await get_game_invite(game_id)
    return game_invite

# Here we can only require a valid invoice key because Player has not been not created yet (called on invite)
@play_ext.get("/api/v1/players_count", status_code=HTTPStatus.OK)
async def api_difficulty_players_count(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_invoice_key)
):
    return await get_active_players_count(game_id)

@play_ext.get("/api/v1/property", status_code=HTTPStatus.OK)
async def api_difficulty_properties(
    game_id: str,
    color: str,
    property_id: int,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_property(game_id, color, property_id)

@play_ext.get("/api/v1/player_pay_link", status_code=HTTPStatus.OK)
async def api_difficulty_player_pay_link(
    game_id: str,
    pay_link_player_index: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_player_pay_link(
        GetPayLink(
            game_id=player_wallet_info.game_id,
            pay_link_player_index=pay_link_player_index
        )
    )

@play_ext.get("/api/v1/cumulated_fines", status_code=HTTPStatus.OK)
async def api_difficulty_cumulated_fines(
    game_id: str,
    player_wallet_info: PlayerWalletInfo = Depends(require_player_invoice_key)
):
    return await get_cumulated_fines(game_id)
