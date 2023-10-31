import random
from . import db
from typing import Optional
from .models import CreateGameData, CreateFirstPlayerData, UpdateFirstPlayerName, UpdatePlayerName, UpdateMarketLiquidityData, UpdateGameFundingData, StartGameData, UpdateVoucherData, UpdateGamePayLinkData, UpdateGameInvoiceData, CreatePlayerData, InvitePlayerData, UpdatePlayerBalance, Game, MarketLiquidity, PlayerBalance, GameFunding, GameStarted, Voucher, PayLink, Invoice, GameWithPayLink, GameWithInvoice, Player, Property, UpdatePropertyOwner, UpdatePropertyIncome, UpgradeProperty, CardIndex, InitCardsIndex, UpdateCardIndex, UpdateCumulatedFines, ResetCumulatedFines, CumulatedFines, UpdatePlayerPayLink, PlayerPayLink
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
        INSERT INTO monopoly.games (admin_wallet_id, game_id, max_players_count, cumulated_fines, available_player_names)
        VALUES (?, ?, ?, ?, ?)
        """,
        (data.admin_wallet_id, data.game_id, data.max_players_count, data.cumulated_fines, data.available_player_names),
    )

    game_created = await get_game(data.game_id)
    assert game_created, "Newly created game couldn't be retrieved"
    return game_created

async def update_market_liquidity(data: UpdateMarketLiquidityData) -> MarketLiquidity:
    await db.execute(
            """
            UPDATE monopoly.games SET market_liquidity = ? WHERE game_id = ?
            """,
            (data.balance, data.game_id),
    )
    game_updated = await get_game(data.game_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def update_game_funding(data: UpdateGameFundingData) -> GameFunding:
     await db.execute(
             """
             UPDATE monopoly.games SET initial_funding = ?, initial_player_balance = ? WHERE game_id = ?
             """,
             (data.initial_funding, data.initial_player_balance, data.game_id),
     )
     game_updated = await get_game(data.game_id)
     assert game_updated, "Newly updated game couldn't be retrieved"
     return game_updated

async def start_game(data: StartGameData) -> GameStarted:
     await db.execute(
             """
             UPDATE monopoly.games SET started = ? WHERE game_id = ?
             """,
             (data.started, data.game_id),
     )
     game_updated = await get_game(data.game_id)
     assert game_updated, "Newly updated game couldn't be retrieved"
     return game_updated


async def update_invite_voucher(data: UpdateVoucherData) -> Voucher:
    await db.execute(
            """
            UPDATE monopoly.games SET invite_voucher_id = ? WHERE game_id = ?
            """,
            (data.voucher_id, data.game_id),
    )

    game_updated = await get_game(data.game_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def update_reward_voucher(data: UpdateVoucherData) -> Voucher:
    await db.execute(
            """
            UPDATE monopoly.games SET reward_voucher_id = ? WHERE game_id = ?
            """,
            (data.voucher_id, data.game_id),
    )

    game_updated = await get_game(data.game_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def update_game_pay_link(data: UpdateGamePayLinkData) -> PayLink:
    await db.execute(
            """
            UPDATE monopoly.games SET pay_link_id = ?, pay_link = ? WHERE game_id = ?
            """,
            (data.pay_link_id, data.pay_link, data.game_id),
    )

    game_updated = await get_game(data.game_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated


async def update_game_invoice(data: UpdateGameInvoiceData) -> Invoice:
    await db.execute(
            """
            UPDATE monopoly.games SET payment_req = ?, payment_hash = ? WHERE game_id = ?
           """,
           (data.payment_req, data.payment_hash, data.game_id),
    )

    game_updated = await get_game(data.game_id)
    assert game_updated, "Newly updated game couldn't be retrieved"
    return game_updated

async def pick_player_name(game_id: str) -> str:
    # Get available player names for game
    available_player_names_string = await db.fetchone("SELECT available_player_names FROM monopoly.games WHERE game_id = ?", (game_id))
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
        UPDATE monopoly.games SET available_player_names = ? WHERE game_id = ?
        """,
        (new_available_player_names_string, game_id),
    )
    # Return picked player name
    return available_player_names[picked_index]

async def create_player(data: CreatePlayerData) -> Player:
    await db.execute(
        """
        INSERT INTO monopoly.players (player_index, player_user_id, player_wallet_id, player_wallet_name, player_wallet_inkey, player_balance, game_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (data.player_index, data.player_user_id, data.player_wallet_id, data.player_wallet_name, data.player_wallet_inkey, data.player_balance, data.game_id),
    )

    player_created = await get_player(data.player_wallet_id)
    assert player_created, "Newly created player couldn't be retrieved"
    return player_created

async def create_player_wallet(data: CreateFirstPlayerData) -> Player:
    user = await get_user(data.user_id)
    assert user, "User couldn't be retrieved"

    wallet = await create_wallet(user_id=data.user_id, wallet_name="")
    assert wallet, "Newly created wallet couldn't be retrieved"

    player_created = await create_player(
        CreatePlayerData(
            player_index=1,
            player_user_id=user.id,
            player_wallet_id=wallet.id,
            player_wallet_name="",
            player_wallet_inkey=wallet.inkey,
            player_balance=0,
            game_id=data.game_id
        )
    )
    assert player_created, "Invited player couldn't be retrieved"
    return player_created

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

async def invite_player(game_id: str, player_name: str) -> Player:
    # Make sure game is registered
    game = await get_game(game_id)
    assert game, "Game couldn't be retrieved"

    account = await create_account()

    user = await get_user(account.id)
    assert user, "Newly created user couldn't be retrieved"

    wallet = await create_wallet(user_id=user.id, wallet_name=player_name)
    assert wallet, "Newly created wallet couldn't be retrieved"

    players_count = await get_players_count(game_id)
    assert players_count, "Players count couldn't be retrieved"

    player_invited = await create_player(
        CreatePlayerData(
            player_index=players_count[0] + 1,
            player_user_id=user.id,
            player_wallet_id=wallet.id,
            player_wallet_name=wallet.name,
            player_wallet_inkey=wallet.inkey,
            player_balance=0,
            game_id=game_id
        )
    )
    assert player_invited, "Invited player couldn't be retrieved"

    return player_invited

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

async def update_player_pay_link(data: UpdatePlayerPayLink) -> Player:
    await db.execute(
                """
                UPDATE monopoly.players SET player_pay_link_id = ?, player_pay_link = ? WHERE player_wallet_id = ?
               """,
               (data.player_pay_link_id, data.player_pay_link, data.player_wallet_id),
        )

    player_updated = await get_player(data.player_wallet_id)
    assert player_updated, "Newly updated player couldn't be retrieved"
    return player_updated

async def register_property(data: Property) -> Property:
    await db.execute(
            """
            INSERT INTO monopoly.properties (property_id, property_color, property_owner_id, property_mining_capacity, property_mining_income, game_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (data.property_id, data.property_color, data.property_owner_id, data.property_mining_capacity, data.property_mining_income, data.game_id),
        )

    property_registered = await get_property(data.game_id, data.property_color, data.property_id)
    assert property_registered, "Newly created property couldn't be retrieved"
    return property_registered

async def update_property_owner(data: UpdatePropertyOwner) -> Property:
    await db.execute(
            """
            UPDATE monopoly.properties SET property_owner_id = ? WHERE game_id = ? AND property_color = ? AND property_id = ?
           """,
           (data.new_owner, data.game_id, data.property_color, data.property_id),
    )

    property_updated = await get_property(data.game_id, data.property_color, data.property_id)
    assert property_updated, "Newly updated property couldn't be retrieved"
    return property_updated

async def upgrade_property(data: UpgradeProperty) -> Property:
    property_to_upgrade = await get_property(data.game_id, data.property_color, data.property_id)
    new_mining_capacity = 0
    if (property_to_upgrade.property_mining_capacity < 4):
        new_mining_capacity = property_to_upgrade.property_mining_capacity + 1
    elif(property_to_upgrade.property_mining_capacity == 4):
        new_mining_capacity = 10
    else:
        new_mining_capacity = property_to_upgrade.property_mining_capacity

    await db.execute(
           """
           UPDATE monopoly.properties SET property_mining_capacity = ? WHERE game_id = ? AND property_color = ? AND property_id = ?
          """,
          (new_mining_capacity, data.game_id, data.property_color, data.property_id),
    )
    property_updated = await get_property(data.game_id, data.property_color, data.property_id)
    assert property_updated, "Newly updated property couldn't be retrieved"
    return property_updated

async def update_property_income(data: UpdatePropertyIncome) -> Property:
    property_to_update = await get_property(data.game_id, data.property_color, data.property_id)
    new_income = property_to_update.property_mining_income + data.income_increment

    await db.execute(
            """
            UPDATE monopoly.properties SET property_mining_income = ? WHERE game_id = ? AND property_color = ? AND property_id = ?
           """,
           (new_income, data.game_id, data.property_color, data.property_id),
    )

    property_updated = await get_property(data.game_id, data.property_color, data.property_id)
    assert property_updated, "Newly updated property couldn't be retrieved"
    return property_updated

async def initialize_cards_indexes(data: InitCardsIndex):
    await db.execute(
        """
        INSERT INTO monopoly.cards (game_id, card_type, next_index)
        VALUES (?, ?, ?)
        """,
        (data.game_id, "chance", 0),
    )
    next_chance_card_index = await get_next_chance_card_index(data.game_id)
    assert next_chance_card_index, "Next chance card index couldn't be retrieved"

    await db.execute(
        """
        INSERT INTO monopoly.cards (game_id, card_type, next_index)
        VALUES (?, ?, ?)
        """,
        (data.game_id, "community_chest", 0),
    )
    next_community_chest_card_index = await get_next_community_chest_card_index(data.game_id)
    assert next_community_chest_card_index, "Next community chest card index couldn't be retrieved"

async def update_next_card_index(data: UpdateCardIndex) -> int:
    next_card_index = 0
    if (data.card_type == "chance"):
        card_index = await get_next_chance_card_index(data.game_id)
    elif (data.card_type == "community_chest"):
        card_index = await get_next_community_chest_card_index(data.game_id)

    assert card_index, "Card index couldn't be retrieved"

    next_card_index = card_index.next_index + 1

    if (next_card_index > 15):
        next_card_index = 0

    await db.execute(
            """
            UPDATE monopoly.cards SET next_index = ? WHERE game_id= ? AND card_type = ?
           """,
           (next_card_index, data.game_id, data.card_type),
    )

    updated_next_card_index = 0
    if (data.card_type == "chance"):
        card_index = await get_next_chance_card_index(data.game_id)
    elif (data.card_type == "community_chest"):
        card_index = await get_next_community_chest_card_index(data.game_id)

    assert card_index, "Card index couldn't be retrieved after update"

    updated_next_card_index = card_index.next_index

    assert (updated_next_card_index >= 0), "Updated next card index couldn't be retrieved"
    return updated_next_card_index

async def update_cumulated_fines(data: UpdateCumulatedFines) -> CumulatedFines:
    cumulated_fines = await get_cumulated_fines(data.game_id)
    updated_cumulated_fines = cumulated_fines.cumulated_fines + data.fine

    await db.execute(
            """
            UPDATE monopoly.games SET cumulated_fines = ? WHERE game_id= ?
           """,
           (updated_cumulated_fines, data.game_id),
    )
    cumulated_fines_updated = await get_cumulated_fines(data.game_id)
    assert cumulated_fines_updated, "Newly updated cumulated fines couldn't be retrieved"
    return cumulated_fines_updated

async def reset_cumulated_fines(data: ResetCumulatedFines) -> CumulatedFines:
    await db.execute(
            """
            UPDATE monopoly.games SET cumulated_fines = 0 WHERE game_id= ?
           """,
           (data.game_id),
    )
    cumulated_fines_reset = await get_cumulated_fines(data.game_id)
    assert cumulated_fines_reset, "Newly reset cumulated fines couldn't be retrieved"
    return cumulated_fines_reset


# Getters
async def get_game(game_id: str) -> Game:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return Game(**row) if row else None

async def get_market_liquidity(game_id: str) -> MarketLiquidity:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return MarketLiquidity(**row) if row else None

async def get_game_started(game_id: str) -> GameStarted:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameStarted(**row) if row else None

async def get_game_with_pay_link(game_id: str) -> GameWithPayLink:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameWithPayLink(**row) if row else None

async def get_game_with_invoice(game_id: str) -> GameWithInvoice:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameWithInvoice(**row) if row else None

async def get_player(player_wallet_id: str) -> Player:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE player_wallet_id = ?", (player_wallet_id,))
    return Player(**row) if row else None

async def get_player_balance(player_wallet_id: str) -> PlayerBalance:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE player_wallet_id = ?", (player_wallet_id,))
    return PlayerBalance(**row) if row else None

async def get_player_pay_link(player_wallet_id: str) -> PlayerPayLink:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE player_wallet_id = ?", (player_wallet_id,))
    return PlayerPayLink(**row) if row else None

async def get_players(game_id: str) -> Player:
    rows = await db.fetchall("SELECT * FROM monopoly.players WHERE game_id = ?", (game_id,))
    return[Player(**row) for row in rows]

async def get_players_count(game_id: str) -> int:
    count = await db.fetchone("SELECT COUNT(*) FROM monopoly.players WHERE game_id = ?", (game_id))
    return count

async def get_max_players_count(game_id: str) -> int:
    max_players_count = await db.fetchone("SELECT max_players_count FROM monopoly.games WHERE game_id = ?", (game_id))
    return max_players_count

async def get_properties(game_id: str) -> Property:
    rows = await db.fetchall("SELECT * FROM monopoly.properties WHERE game_id = ?", (game_id,))
    return[Property(**row) for row in rows]

async def get_property(game_id: str, property_color: str, property_id: int) -> Property:
    row = await db.fetchone("SELECT * FROM monopoly.properties WHERE game_id = ? AND property_color = ? AND property_id = ?", (game_id, property_color, property_id))
    return Property(**row) if row else None

async def get_next_chance_card_index(game_id: str) -> CardIndex:
    row = await db.fetchone("SELECT * FROM monopoly.cards WHERE game_id = ? AND card_type = ?", (game_id, "chance"))
    return CardIndex(**row) if row else None

async def get_next_community_chest_card_index(game_id: str) -> CardIndex:
    row = await db.fetchone("SELECT * FROM monopoly.cards WHERE game_id = ? AND card_type = ?", (game_id, "community_chest"))
    return CardIndex(**row) if row else None

async def get_cumulated_fines(game_id: str) -> CumulatedFines:
    row = await db.fetchone("SELECT cumulated_fines FROM monopoly.games WHERE game_id = ?", (game_id))
    return row
