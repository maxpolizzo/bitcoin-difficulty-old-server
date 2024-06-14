from fastapi import (
    Security,
    HTTPException,
    status
)
from starlette.requests import Request
from lnbits.decorators import (
    require_admin_key,
    require_invoice_key,
    api_key_header,
    api_key_query
)
from .crud import (
    get_game,
    get_game_admin_user_id,
    is_active_player,
    get_player_wallet_info,
    get_player_wallet,
    get_player_wallet_by_player_index
)
from .models import PlayerWalletInfo
# Requires an invoice key from a player wallet registered with the game id passed in the request
# Used for GET requests of non-critical data
async def require_player_invoice_key(
    r: Request,
    api_key_header: str = Security(api_key_header),  # type: ignore
    api_key_query: str = Security(api_key_query),  # type: ignore
):

    token = api_key_header or api_key_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player invoice key required.",
        )

    walletInfo = await require_invoice_key(r, api_key_header, api_key_query)

    # Check that the requested wallet is registered for the game
    player_wallet_info = await get_player_wallet_info(walletInfo.wallet.id)
    if player_wallet_info.game_id != r.query_params['game_id']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: wallet not registered for game."
        )
    else:
        # If player wallet is not free market wallet, check if player is active
        if player_wallet_info.player_index != "0":
            is_active = await is_active_player(player_wallet_info.game_id, player_wallet_info.player_index)
            if is_active != True :
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: not an active player"
                )
        return player_wallet_info

# Requires the admin key of the wallet id passed in the request
# Used for GET requests of critical wallet data
async def require_player_admin_key(
    r: Request,
    api_key_header: str = Security(api_key_header),  # type: ignore
    api_key_query: str = Security(api_key_query),  # type: ignore
):

    token = api_key_header or api_key_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player admin key required.",
        )

    walletInfo = await require_admin_key(r, api_key_header, api_key_query)

    # Check that the wallet id is the same as the one passed in the request
    if walletInfo.wallet.id != r.query_params['wallet_id']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: wallet_id and adminkey do not match."
        )
    else:
        # Get player wallet
        player_wallet = await get_player_wallet(walletInfo.wallet.id)
        return player_wallet

# Requires the invoice key corresponding to the player wallet id passed in the request
# Used for POST/PUT requests of wallet data
async def require_player_wallet_invoice_key(
    r: Request,
    api_key_header: str = Security(api_key_header),  # type: ignore
    api_key_query: str = Security(api_key_query),  # type: ignore
):

    token = api_key_header or api_key_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player invoice key required.",
        )

    walletInfo = await require_invoice_key(r, api_key_header, api_key_query)

    # Check that api key is the wallet's invoice key
    body = await r.json()
    if walletInfo.wallet.id != body['wallet_id']:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: wallet_id and inkey do not match."
        )
    else:
        # Check that the requested wallet is registered for the game
        player_wallet_info = await get_player_wallet_info(walletInfo.wallet.id)
        if player_wallet_info.game_id != body['game_id']:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: wallet not registered for game."
            )
        else:
            # If player_wallet is not free market wallet, check if player is active
            if player_wallet_info.player_index != "0":
                is_active = await is_active_player(player_wallet_info.game_id, player_wallet_info.player_index)
                if is_active != True :
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: not an active player"
                    )
            return player_wallet_info

# Requires the invoice key corresponding to the wallet of the player index passed in the request
# Used for POST/PUT requests of wallet data
async def require_player_index_invoice_key(
    r: Request,
    api_key_header: str = Security(api_key_header),  # type: ignore
    api_key_query: str = Security(api_key_query),  # type: ignore
):

    token = api_key_header or api_key_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player invoice key required.",
        )

    walletInfo = await require_invoice_key(r, api_key_header, api_key_query)

    body = await r.json()
    # Get the wallet corresponding to player index and game id
    player_wallet = await get_player_wallet_by_player_index(body['game_id'], body['player_index'])
    # Check that api key is the wallet's invoice key
    if walletInfo.wallet.id != player_wallet.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: game_id, player_index and inkey do not match."
        )
    else:
        # If player_wallet is not free market wallet, check if player is active
        if player_wallet.player_index != "0":
            is_active = await is_active_player(player_wallet.game_id, player_wallet.player_index)
            if is_active != True :
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: not an active player"
                )
        return PlayerWalletInfo(
            game_id=player_wallet.game_id,
            is_free_market=player_wallet.is_free_market,
            player_index=player_wallet.player_index
        )

# Requires the admin key corresponding to the admin_user_id of the game_id passed in the request
# Used for admin POST/PUT requests of game/wallet/player data
async def require_game_creator_admin_key(
    r: Request,
    api_key_header: str = Security(api_key_header),  # type: ignore
    api_key_query: str = Security(api_key_query),  # type: ignore
):

    token = api_key_header or api_key_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player admin key required.",
        )

    walletInfo = await require_admin_key(r, api_key_header, api_key_query)

    # Check that the user id is the admin_user_id corresponding to the game_id passed in the request
    body = await r.json()
    game_admin_user_id = await get_game_admin_user_id(body['game_id'])
    if walletInfo.wallet.user != game_admin_user_id.admin_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Error: game's admin_user_id and adminkey do not match."
        )
    else:
        return game_admin_user_id
