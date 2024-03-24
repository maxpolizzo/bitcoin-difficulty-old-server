import random
from uuid import uuid4
from lnbits.core.models import User
from lnbits.core.crud import (
    create_account,
    create_wallet,
    get_wallet,
    get_user
)
from . import db
from .models import (
    CreateGame,
    Game,
    GameId,
    GameAdminUserId,
    GameStarted,
    Player,
    CreatePlayerWallet,
    PlayerWallet,
    RegisterWalletPayLink,
    PayLink,
    UpdateFreeMarketLiquidity,
    FreeMarketLiquidity,
    PlayerWalletInfo,
    CreateFirstPlayer,
    CreatePlayer,
    NewPlayerData,
    UpdatePlayerBalance,
    PlayerBalance,
    CreateVoucher,
    UpdateGameFunding,
    InvitedPlayer,
    GameInvite,
    JoinGame,
    InitializeCards,
    Card,
    PickCard,
    PlayerIndex,
    GetPayLink,
    Property,
    UpdatePropertyIncome,
    UpgradeMiners,
    UpdateCumulatedFines
)

# Setters
async def create_game(data: CreateGame, admin_user_id: str) -> Game:
    game_id = uuid4().hex
    await db.execute(
        """
        INSERT INTO monopoly.games (game_id, admin_user_id, max_players_count, available_player_names, cumulated_fines)
        VALUES (?, ?, ?, ?, ?)
        """,
        (game_id, admin_user_id, data.max_players_count, data.available_player_names, 0),
    )
    game = await get_game(game_id)
    assert game, "Error: game" + game_id + "couldn't be retrieved"
    return game

async def create_free_market_wallet(data: GameId, user_id: str) -> PlayerWallet:
    wallet = await create_wallet(user_id = user_id, wallet_name = "Free market")
    free_market_wallet = await create_player_wallet(
        CreatePlayerWallet(
            game_id=data.game_id,
            is_free_market=True,
            player_index=0,
            user=user_id,
            id=wallet.id,
            inkey=wallet.inkey,
            adminkey=wallet.adminkey,
        )
    )
    assert free_market_wallet, "Error: free market wallet couldn't be retrieved"
    return free_market_wallet

async def create_player_wallet(data: CreatePlayerWallet) -> PlayerWallet:
    await db.execute(
        """
        INSERT INTO monopoly.wallets (
        game_id, is_free_market, player_index, user, id, inkey, adminkey)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (data.game_id, data.is_free_market, data.player_index, data.user, data.id, data.inkey, data.adminkey),
    )
    player_wallet = await get_player_wallet(data.id)
    assert player_wallet, "Error: player wallet couldn't be retrieved"
    return player_wallet

async def update_wallet_pay_link(data: RegisterWalletPayLink) -> PayLink:
    await db.execute(
            """
            UPDATE monopoly.wallets SET pay_link_id = ?, pay_link = ? WHERE id = ?
            """,
            (data.pay_link_id, data.pay_link, data.wallet_id),
    )

    pay_link = await get_wallet_pay_link(data.wallet_id)
    assert pay_link, "Error: wallet pay link couldn't be retrieved"
    return pay_link

async def update_free_market_liquidity(data: UpdateFreeMarketLiquidity) -> FreeMarketLiquidity:
    await db.execute(
            """
            UPDATE monopoly.games SET free_market_liquidity = ? WHERE game_id = ?
            """,
            (data.free_market_liquidity, data.game_id),
    )

async def create_first_player(data: CreateFirstPlayer) -> NewPlayerData:
    user = await get_user(data.user_id)
    assert user, "User couldn't be retrieved"
    name = await pick_player_name(data.game_id)
    wallet = await create_wallet(user_id=data.user_id, wallet_name=name)
    assert wallet, "Newly created wallet couldn't be retrieved"

    first_player = await create_player(
        CreatePlayer(
            game_id=data.game_id,
            player_index=1,
            player_name=name,
        )
    )

    first_player_wallet = await create_player_wallet(
        CreatePlayerWallet(
            game_id=data.game_id,
            is_free_market=False,
            player_index=1,
            user=wallet.user,
            id=wallet.id,
            inkey=wallet.inkey,
            adminkey=wallet.adminkey,
        )
    )
    return NewPlayerData(
        player_index=1,
        name=name,
        user=first_player_wallet.user,
        id=first_player_wallet.id,
        inkey=first_player_wallet.inkey,
        adminkey=first_player_wallet.adminkey,
    )

async def create_player(data: CreatePlayer) -> Player:
    await db.execute(
        """
        INSERT INTO monopoly.players (
            game_id,
            player_index,
            player_name,
            player_balance
         )
        VALUES (?, ?, ?, ?)
        """,
        (data.game_id, data.player_index, data.player_name, 0),
    )

    player = await get_player(data.game_id, data.player_index)
    assert player, "Newly created player couldn't be retrieved"
    return player

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

async def update_player_balance(data: UpdatePlayerBalance) -> PlayerBalance:
    await db.execute(
            """
            UPDATE monopoly.players SET player_balance = ? WHERE game_id = ? AND player_index = ?
           """,
           (data.balance, data.game_id, data.player_index),
    )

    player = await get_player(data.game_id, data.player_index)
    assert player, "Newly updated player couldn't be retrieved"
    return PlayerBalance(
        balance=player.player_balance
    )

async def create_reward_voucher(data: CreateVoucher):
    await db.execute(
            """
            UPDATE monopoly.games SET reward_voucher_id = ? WHERE game_id = ?
            """,
            (data.voucher_id, data.game_id),
    )

async def create_invite_voucher(data: CreateVoucher):
    await db.execute(
            """
            UPDATE monopoly.games SET invite_voucher_id = ? WHERE game_id = ?
            """,
            (data.voucher_id, data.game_id),
    )

async def update_game_funding(data: UpdateGameFunding):
     await db.execute(
             """
             UPDATE monopoly.games SET initial_funding = ?, initial_player_balance = ? WHERE game_id = ?
             """,
             (data.initial_funding, data.initial_player_balance, data.game_id),
     )

async def invite_player(game_id: str) -> InvitedPlayer:
    # Make sure game is registered
    game = await get_game(game_id)
    assert game, "Game couldn't be retrieved"
    # Create LNBits user account for invited player
    account = await create_account()
    user = await get_user(account.id)
    assert user, "Newly created user couldn't be retrieved"
    # Pick random name for invited player
    player_name = await pick_player_name(game_id)
    # Create LNBits wallet for invited player
    wallet = await create_wallet(user_id=user.id, wallet_name=player_name)
    assert wallet, "Newly created wallet couldn't be retrieved"

    invited_user = InvitedPlayer(
        id=user.id,
        name=player_name
    )
    return invited_user

async def join_game(data: JoinGame) -> Player:
    user = await get_user(data.user_id)
    assert user, "User couldn't be retrieved"
    wallet = await get_wallet(data.wallet_id)
    assert wallet, "Newly updated wallet couldn't be retrieved"

    assert data.user_id == wallet.user, "User and wallet do not match"

    player = await create_player(
        CreatePlayer(
            game_id=data.game_id,
            player_index=data.player_index,
            player_name=data.player_name,
        )
    )

    player_wallet = await create_player_wallet(
        CreatePlayerWallet(
            game_id=data.game_id,
            is_free_market=False,
            player_index=data.player_index,
            user=data.user_id,
            id=data.wallet_id,
            inkey=wallet.inkey,
            adminkey=wallet.adminkey,
        )
    )
    return Player(
        game_id=data.game_id,
        player_index=data.player_index,
        player_name=data.player_name,
        player_balance=0
    )

async def initialize_cards(data: InitializeCards):
    # Generate technology cards ids string
    technology_cards_ids = ""
    for i in list(range(data.technology_cards_max_index)):
        technology_cards_ids += str(i) + ","
    technology_cards_ids = technology_cards_ids[slice(-1)]
    # Shuffle technology cards ids
    shuffled_technology_cards_ids = shuffle_cards_ids(technology_cards_ids, "")
    # Initialize technology cards record
    await db.execute(
        """
        INSERT INTO monopoly.cards (game_id, card_type, ids, card_index, max_index)
        VALUES (?, ?, ?, ?, ?)
        """,
        (data.game_id, "technology", shuffled_technology_cards_ids, 0, data.technology_cards_max_index),
    )
    technology_card = await get_card(data.game_id, "technology")
    assert technology_card, "Technology card couldn't be retrieved"

    # Generate black swan cards ids string
    black_swan_cards_ids = ""
    for i in list(range(data.black_swan_cards_max_index)):
        black_swan_cards_ids += str(i) + ","
    black_swan_cards_ids = black_swan_cards_ids[slice(-1)]
    # Shuffle black swan cards ids
    shuffled_black_swan_cards_ids = shuffle_cards_ids(black_swan_cards_ids, "")
    # Initialize black swan cards record
    await db.execute(
        """
        INSERT INTO monopoly.cards (game_id, card_type, ids, card_index, max_index)
        VALUES (?, ?, ?, ?, ?)
        """,
        (data.game_id, "black_swan", shuffled_black_swan_cards_ids, 0, data.black_swan_cards_max_index),
    )
    black_swan_card = await get_card(data.game_id, "black_swan")
    assert black_swan_card, "Black_swan card couldn't be retrieved"

def shuffle_cards_ids(cards_ids: str, shuffled_cards_ids: str) -> str:
    # Get cards ids array
    cards_ids_array = cards_ids.split(",")
    if (len(cards_ids_array) > 1) :
        # Pick a random index
        picked_index = random.sample(range(0, len(cards_ids_array)), 1)[0]
        # Append picked card id to shuffled_cards_ids string
        shuffled_cards_ids += cards_ids_array[picked_index] + ","
        # Get remaining cards ids string
        remaining_cards_ids = ""
        for i in list(range(len(cards_ids_array))):
            if (i != picked_index) :
                remaining_cards_ids += cards_ids_array[i] + ","
        # Call back recursively
        remaining_cards_ids = remaining_cards_ids[slice(-1)]
        return shuffle_cards_ids(remaining_cards_ids, shuffled_cards_ids)
    else:
        shuffled_cards_ids += cards_ids
        return shuffled_cards_ids

async def pick_card(data: PickCard) -> str:

    # Figure out other card type
    other_card_type = ""
    if (data.card_type == "technology"):
        other_card_type = "black_swan"
    elif (data.card_type == "black_swan"):
        other_card_type = "technology"

    # Check if player already picked the other card type
    other_card_picked = await get_player_card_picked(data.game_id, data.player_index, other_card_type)

    if(other_card_picked[0] == False):

        # Check if player already picked the same card type
        card_picked = await get_player_card_picked(data.game_id, data.player_index, data.card_type)

        # If player did not already pick the other card type, update player and card
        if (card_picked[0]  == False):
            # Get card
            card = await get_card(data.game_id, data.card_type)
            assert card, "Card couldn't be retrieved"

            # Update player card_picked
            await db.execute(
                """
                UPDATE monopoly.players SET """ + data.card_type + """_card_picked = ? WHERE game_id = ? AND player_index = ?
                """,
                (True, data.game_id, data.player_index),
            )

            # Update card index
            if (card.card_index >= card.max_index):
                next_card_index = 0
            else:
                next_card_index = card.card_index + 1

            await db.execute(
                    """
                    UPDATE monopoly.cards SET card_index = ? WHERE game_id = ? AND card_type = ?
                   """,
                   (next_card_index, data.game_id, data.card_type),
            )

        # Get card
        card = await get_card(data.game_id, data.card_type)
        assert card, "Card couldn't be retrieved"
        # Get card id
        cards_ids_array = card.ids.split(",")
        card_id = cards_ids_array[card.card_index]

        return card_id

    # If player already picked the other card type, raise an exception
    else:
        return "already_picked"

async def start_game(data: GameId):
    players_count = await get_players_count(data.game_id)
    # Pick a random index for first player turn
    first_player_turn = random.sample(range(1, players_count[0] + 1), 1)[0]

    await db.execute(
         """
         UPDATE monopoly.games SET started = ?, player_turn = ? WHERE game_id = ?
         """,
         (True, first_player_turn, data.game_id),
    )

async def next_player_turn(data: PlayerIndex) -> int:
    players_count = await get_players_count(data.game_id)
    player_turn = await get_player_turn(data.game_id)

    assert player_turn[0] == data.player_index, "Player cannot increment player_turn"

    next_player_turn = player_turn[0] + 1
    if(next_player_turn > players_count[0]):
        next_player_turn = 1

    # Update game player_turn
    await db.execute(
      """
      UPDATE monopoly.games SET player_turn = ? WHERE game_id = ?
      """,
      (next_player_turn, data.game_id),
    )

    # Update player technology_card_picked and black_swan_card_picked to false for next player
    await db.execute(
        """
        UPDATE monopoly.players SET technology_card_picked = ? WHERE game_id = ? AND player_index = ?
        """,
        (False, data.game_id, next_player_turn),
    )
    await db.execute(
        """
        UPDATE monopoly.players SET black_swan_card_picked = ? WHERE game_id = ? AND player_index = ?
        """,
        (False, data.game_id, next_player_turn),
    )

    # Update player pow_provided to false for next player
    await db.execute(
        """
        UPDATE monopoly.players SET pow_provided = ? WHERE game_id = ? AND player_index = ?
       """,
       (False, data.game_id, next_player_turn),
    )

    return next_player_turn

async def register_property(data: Property):
    await db.execute(
            """
            INSERT INTO monopoly.properties (game_id, property_id, color, player_index, mining_capacity, mining_income)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (data.game_id, data.property_id, data.color, data.player_index, data.mining_capacity, data.mining_income),
        )

async def transfer_property_ownership(data: Property):
    await db.execute(
            """
            UPDATE monopoly.properties SET player_index = ? WHERE game_id = ? AND color = ? AND property_id = ?
           """,
           (data.player_index, data.game_id, data.color, data.property_id),
    )

async def update_property_income(data: UpdatePropertyIncome):
    property_to_update = await get_property(data.game_id, data.color, data.property_id)
    new_income = property_to_update.mining_income + data.income_increment

    await db.execute(
            """
            UPDATE monopoly.properties SET mining_income = ? WHERE game_id = ? AND color = ? AND property_id = ?
           """,
           (new_income, data.game_id, data.color, data.property_id),
    )

async def upgrade_property_miners(data: UpgradeMiners):
    property_to_upgrade = await get_property(data.game_id, data.color, data.property_id)
    new_mining_capacity = 0
    if (property_to_upgrade.mining_capacity < 4):
        new_mining_capacity = property_to_upgrade.mining_capacity + 1
    elif(property_to_upgrade.mining_capacity == 4):
        new_mining_capacity = 10
    else:
        new_mining_capacity = property_to_upgrade.mining_capacity

    await db.execute(
           """
           UPDATE monopoly.properties SET mining_capacity = ? WHERE game_id = ? AND color = ? AND property_id = ?
          """,
          (new_mining_capacity, data.game_id, data.color, data.property_id),
    )

async def update_player_pow_provided(data: PlayerIndex):
    await db.execute(
        """
        UPDATE monopoly.players SET pow_provided = ? WHERE game_id = ? AND player_index = ?
       """,
       (True, data.game_id, data.player_index),
    )

async def update_cumulated_fines(data: UpdateCumulatedFines):
    cumulated_fines = await get_cumulated_fines(data.game_id)
    updated_cumulated_fines = cumulated_fines.cumulated_fines + data.fine

    await db.execute(
        """
        UPDATE monopoly.games SET cumulated_fines = ? WHERE game_id= ?
       """,
       (updated_cumulated_fines, data.game_id),
    )

async def reset_cumulated_fines(data: PlayerIndex):
    await db.execute(
        """
        UPDATE monopoly.games SET cumulated_fines = 0 WHERE game_id= ?
       """,
       (data.game_id),
    )

# Getters
async def get_game(game_id: str) -> Game:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return Game(**row) if row else None

async def get_game_admin_user_id(game_id: str) -> GameAdminUserId:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameAdminUserId(**row) if row else None

async def get_player_wallet(wallet_id: str) -> PlayerWallet:
    row = await db.fetchone("SELECT * FROM monopoly.wallets WHERE id = ?", (wallet_id,))
    return PlayerWallet(**row) if row else None

async def get_player_wallet_by_player_index(game_id: str, player_index: int) -> PlayerWallet:
    row = await db.fetchone("SELECT * FROM monopoly.wallets WHERE game_id = ? AND player_index = ?", (game_id, player_index))
    return PlayerWallet(**row) if row else None

async def get_wallet_pay_link(wallet_id: str) -> PayLink:
    row = await db.fetchone("SELECT * FROM monopoly.wallets WHERE id = ?", (wallet_id,))
    return PayLink(**row) if row else None

async def get_free_market_liquidity(game_id: str) -> FreeMarketLiquidity:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return FreeMarketLiquidity(**row) if row else None

async def get_player_wallet_info(wallet_id: str) -> PlayerWalletInfo:
    row = await db.fetchone("SELECT * FROM monopoly.wallets WHERE id = ?", (wallet_id,))
    return PlayerWalletInfo(**row) if row else None

async def get_game_started(game_id: str) -> GameStarted:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameStarted(**row) if row else None

async def get_player(game_id: str, player_index: int) -> Player:
    row = await db.fetchone("SELECT * FROM monopoly.players WHERE game_id = ? AND player_index = ?", (game_id, player_index))
    return Player(**row) if row else None

async def get_players(game_id: str) -> [Player]:
    rows = await db.fetchall("SELECT * FROM monopoly.players WHERE game_id = ?", (game_id))
    return[Player(**row) for row in rows]

async def get_player_turn(game_id: str) -> int:
    player_turn = await db.fetchone("SELECT player_turn FROM monopoly.games WHERE game_id = ?", (game_id))
    return player_turn

async def get_properties(game_id: str) -> [Property]:
    rows = await db.fetchall("SELECT * FROM monopoly.properties WHERE game_id = ?", (game_id,))
    return[Property(**row) for row in rows]

async def get_game_invite(game_id: str) -> GameInvite:
    row = await db.fetchone("SELECT * FROM monopoly.games WHERE game_id = ?", (game_id,))
    return GameInvite(**row) if row else None

async def get_max_players_count(game_id: str) -> int:
    max_players_count = await db.fetchone("SELECT max_players_count FROM monopoly.games WHERE game_id = ?", (game_id))
    return max_players_count

async def get_players_count(game_id: str) -> int:
    players_count = await db.fetchone("SELECT COUNT(*) FROM monopoly.players WHERE game_id = ?", (game_id))
    return players_count

async def get_card(game_id: str, card_type) -> Card:
    row = await db.fetchone("SELECT * FROM monopoly.cards WHERE game_id = ? AND card_type = ?", (game_id, card_type))
    return Card(**row) if row else None

async def get_player_card_picked(game_id: str, player_index: int, card_type: str) -> bool:
    if (card_type == "technology"):
        card_picked = await db.fetchone("SELECT technology_card_picked FROM monopoly.players WHERE game_id = ? AND player_index = ?", (game_id, player_index))
        return card_picked
    elif (card_type == "black_swan"):
        card_picked = await db.fetchone("SELECT black_swan_card_picked FROM monopoly.players WHERE game_id = ? AND player_index = ?", (game_id, player_index))
        return card_picked
    else:
        return True

async def get_property(game_id: str, color: str, property_id: int) -> Property:
    row = await db.fetchone("SELECT * FROM monopoly.properties WHERE game_id = ? AND color = ? AND property_id = ?", (game_id, color, property_id))
    return Property(**row) if row else None

async def get_player_pay_link(data: GetPayLink) -> PayLink:
    row = await db.fetchone("SELECT * FROM monopoly.wallets WHERE game_id = ? AND player_index = ?", (data.game_id, data.pay_link_player_index))
    return PayLink(**row) if row else None

async def get_cumulated_fines(game_id: str) -> int:
    cumulated_fines = await db.fetchone("SELECT cumulated_fines FROM monopoly.games WHERE game_id = ?", (game_id))
    return cumulated_fines
