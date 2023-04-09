import random
from . import db
from typing import Optional
from .models import CreateGameData, CreateFirstPlayerData, UpdateFirstPlayerName, UpdatePlayerName, UpdateBankBalanceData, UpdateGameFundingData, StartGameData, UpdateGameVoucherData, UpdateGamePayLinkData, UpdateGameInvoiceData, CreatePlayerData, InvitePlayerData, UpdatePlayerBalance, Game, BankBalance, PlayerBalance, GameFunding, GameStarted, Voucher, PayLink, Invoice, GameWithPayLink, GameWithInvoice, Player
from lnbits.core.models import User, Wallet
from lnbits.core.crud import (
    create_account,
    create_wallet,
    update_wallet,
    get_wallet,
    get_user
)

# Setters
async def create_game(data: CreateGameData) -> Game:
    await db.execute(
        """
        INSERT INTO monopoly.games (admin_wallet_id, bank_id, max_players_count, available_player_names)
        VALUES (?, ?, ?, ?)
        """,
        (data.admin_wallet_id, data.bank_id, data.max_players_count, data.available_player_names),
    )

    game_created = await get_game(data.bank_id)
    assert game_created, "Newly created game couldn't be retrieved"
    return game_created

async def update_bank_balance(data: UpdateBankBalanceData) -> BankBalance:
    await db.execute(
            """
            UPDATE monopoly.games SET bank_balance = ? WHERE bank_id = ?
            """,
            (data.balance, data.bank_id),
    )
    game_updated = await get_game(data.bank_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def update_game_funding(data: UpdateGameFundingData) -> GameFunding:
     await db.execute(
             """
             UPDATE monopoly.games SET initial_funding = ?, initial_player_balance = ? WHERE bank_id = ?
             """,
             (data.initial_funding, data.initial_player_balance, data.bank_id),
     )
     game_updated = await get_game(data.bank_id)
     assert game_updated, "Newly updated game couldn't be retrieved"
     return game_updated

async def start_game(data: StartGameData) -> GameStarted:
     await db.execute(
             """
             UPDATE monopoly.games SET started = ? WHERE bank_id = ?
             """,
             (data.started, data.bank_id),
     )
     game_updated = await get_game(data.bank_id)
     assert game_updated, "Newly updated game couldn't be retrieved"
     return game_updated


async def update_game_voucher(data: UpdateGameVoucherData) -> Voucher:
    await db.execute(
            """
            UPDATE monopoly.games SET voucher_id = ? WHERE bank_id = ?
            """,
            (data.voucher_id, data.bank_id),
    )

    game_updated = await get_game(data.bank_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def update_game_pay_link(data: UpdateGamePayLinkData) -> PayLink:
    await db.execute(
            """
            UPDATE monopoly.games SET pay_link_id = ?, pay_link = ? WHERE bank_id = ?
            """,
            (data.pay_link_id, data.pay_link, data.bank_id),
    )

    game_updated = await get_game(data.bank_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated


async def update_game_invoice(data: UpdateGameInvoiceData) -> Invoice:
    await db.execute(
            """
            UPDATE monopoly.games SET payment_req = ?, payment_hash = ? WHERE bank_id = ?
           """,
           (data.payment_req, data.payment_hash, data.bank_id),
    )

    game_updated = await get_game(data.bank_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def pick_player_name(bank_id: str) -> str:
        # Get available player names for game
        available_player_names_string = await db.fetchone("SELECT available_player_names FROM monopoly.games WHERE bank_id = ?", (bank_id))
        available_player_names = available_player_names_string[0].split(",")
        # Pick a random index
        picked_index = random.sample(range(0, len(available_player_names)), 1)[0]
        # Remove picked player name from available player names for game
        new_available_player_names_string = ""
        for i in list(range(len(available_player_names))):
            if (i != picked_index) :
                new_available_player_names_string += available_player_names[i] + ","
        new_available_player_names_string = new_available_player_names_string[slice(-1)]
        # Update available player names for game
        await db.execute(
            """
            UPDATE monopoly.games SET available_player_names = ? WHERE bank_id = ?
            """,
            (new_available_player_names_string, bank_id),
        )
        # Return picked player name
        return available_player_names[picked_index]

async def create_player(data: CreatePlayerData) -> Player:
    await db.execute(
        """
        INSERT INTO monopoly.players (player_wallet_id, player_wallet_name, player_wallet_inkey, player_balance, bank_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        (data.player_wallet_id, data.player_wallet_name, data.player_wallet_inkey, data.player_balance, data.bank_id),
    )

    player_created = await get_player(data.player_wallet_id)
    assert player_created, "Newly created player couldn't be retrieved"
    return player_created

async def create_player_wallet(data: CreateFirstPlayerData) -> Wallet:
    user = await get_user(data.user_id)
    assert user, "User couldn't be retrieved"

    wallet = await create_wallet(user_id=data.user_id, wallet_name="")
    assert wallet, "Newly created wallet couldn't be retrieved"

    player_created = await create_player(
        CreatePlayerData(
            player_wallet_id=wallet.id,
            player_wallet_name="",
            player_wallet_inkey=wallet.inkey,
            player_balance=0,
            bank_id=data.bank_id
        )
    )
    assert player_created, "Invited player couldn't be retrieved"
    return wallet

async def update_first_player_name(data: UpdateFirstPlayerName) -> Wallet:
    await update_wallet(wallet_id=data.player_wallet_id, new_name=data.player_wallet_name)
    wallet = await get_wallet(data.player_wallet_id)
    assert wallet, "Newly updated wallet couldn't be retrieved"

    player = await update_player_name(
        UpdatePlayerName(
            player_wallet_id=data.player_wallet_id,
            player_wallet_name=data.player_wallet_name
        )
    )
    assert player, "Newly updated player couldn't be retrieved"
    return wallet

async def invite_player(game_id: str, player_name: str) -> str:
    # Make sure game is registered
    game = await get_game(game_id)
    assert game, "Game couldn't be retrieved"

    account = await create_account()

    user = await get_user(account.id)
    assert user, "Newly created user couldn't be retrieved"

    wallet = await create_wallet(user_id=user.id, wallet_name=player_name)
    assert wallet, "Newly created wallet couldn't be retrieved"

    player_invited = await create_player(
        CreatePlayerData(
            player_wallet_id=wallet.id,
            player_wallet_name=wallet.name,
            player_wallet_inkey=wallet.inkey,
            player_balance=0,
            bank_id=game_id
        )
    )
    assert player_invited, "Invited player couldn't be retrieved"

    return user.id

async def update_player_name(data: UpdatePlayerName) -> Player:
    await db.execute(
            """
            UPDATE monopoly.players SET player_wallet_name = ? WHERE player_wallet_id = ?
           """,
           (data.player_wallet_name, data.player_wallet_id),
    )

    player_updated = await get_player(data.player_wallet_id)
    assert player_updated, "Newly updated player couldn't be retrieved"
    return player_updated

async def update_player_balance(data: UpdatePlayerBalance) -> Player:
    await db.execute(
            """
            UPDATE monopoly.players SET player_balance = ? WHERE player_wallet_id = ?
           """,
           (data.player_balance, data.player_wallet_id),
    )

    player_updated = await get_player(data.player_wallet_id)
    assert player_updated, "Newly updated player couldn't be retrieved"
    return player_updated

# Getters
async def get_game(bank_id: str) -> Game:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE bank_id = ?", (bank_id,))
    return Game(**row) if row else None

async def get_bank_balance(bank_id: str) -> BankBalance:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE bank_id = ?", (bank_id,))
    return BankBalance(**row) if row else None

async def get_game_started(bank_id: str) -> GameStarted:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE bank_id = ?", (bank_id,))
    return GameStarted(**row) if row else None

async def get_game_with_pay_link(bank_id: str) -> GameWithPayLink:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE bank_id = ?", (bank_id,))
    return GameWithPayLink(**row) if row else None

async def get_game_with_invoice(bank_id: str) -> GameWithInvoice:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE bank_id = ?", (bank_id,))
    return GameWithInvoice(**row) if row else None

async def get_player(player_wallet_id: str) -> Player:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE player_wallet_id = ?", (player_wallet_id,))
    return Player(**row) if row else None

async def get_player_balance(player_wallet_id: str) -> PlayerBalance:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE player_wallet_id = ?", (player_wallet_id,))
    return PlayerBalance(**row) if row else None

async def get_players(bank_id: str) -> Player:
    rows = await db.fetchall("SELECT * FROM monopoly.players WHERE bank_id = ?", (bank_id,))
    return[Player(**row) for row in rows]

async def get_players_count(bank_id: str) -> int:
    count = await db.fetchone("SELECT COUNT(*) FROM monopoly.players WHERE bank_id = ?", (bank_id))
    return count

async def get_max_players_count(bank_id: str) -> int:
    max_players_count = await db.fetchone("SELECT max_players_count FROM monopoly.games WHERE bank_id = ?", (bank_id))
    return max_players_count