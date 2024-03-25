from pydantic import BaseModel
from fastapi.param_functions import Query
from typing import Optional

class Game(BaseModel):
    game_id: str = Query(...)
    free_market_liquidity: Optional[int] = None
    payment_req: Optional[str] = None
    payment_hash: Optional[str] = None
    invite_voucher_id: Optional[str] = None
    reward_voucher_id: Optional[str] = None
    initial_funding: Optional[int] = None
    initial_player_balance: Optional[int] = None
    started: bool
    max_players_count: int
    available_player_names: str = Query(...)
    cumulated_fines: Optional[int] = None
    player_turn: int
    time: str = Query(...)

class GameId(BaseModel):
    game_id: str = Query(...)

class GameAdminUserId(BaseModel):
    game_id: str = Query(...)
    admin_user_id: str = Query(...)

class CreateGame(BaseModel):
    max_players_count: int
    available_player_names: str =  Query(...)

class CreatePlayerWallet(BaseModel):
    game_id: str = Query(...)
    is_free_market: bool
    player_index: int
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)

class PlayerWallet(BaseModel):
    game_id: str = Query(...)
    is_free_market: bool
    player_index: int
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)
    pay_link_id: Optional[str] = None
    pay_link: Optional[str] = None

class PlayerWalletInfo(BaseModel):
    game_id: str = Query(...)
    is_free_market: bool
    player_index: int

class RegisterWalletPayLink(BaseModel):
    game_id: str = Query(...)
    wallet_id: str = Query(...)
    pay_link_id: str = Query(...)
    pay_link: str = Query(...)

class PayLink(BaseModel):
    pay_link_id: str = Query(...)
    pay_link: str = Query(...)

class UpdateFreeMarketLiquidity(BaseModel):
    game_id: str = Query(...)
    free_market_liquidity: int

class FreeMarketLiquidity(BaseModel):
    free_market_liquidity: int

class GameStarted(BaseModel):
    started: bool

class GameTime(BaseModel):
    time: str = Query(...)

class CreateFirstPlayer(BaseModel):
    game_id: str = Query(...)
    user_id: str = Query(...)

class CreatePlayer(BaseModel):
    game_id: str = Query(...)
    player_index: int
    player_name: str

class Player(BaseModel):
    game_id: str
    player_index: int
    player_name: str
    player_balance: int

class NewPlayerData(BaseModel):
    player_index: int
    name: str
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)

class UpdatePlayerBalance(BaseModel):
    game_id: str = Query(...)
    player_index: int
    balance: int

class PlayerBalance(BaseModel):
   balance: int

class CreateVoucher(BaseModel):
    game_id: str = Query(...)
    voucher_id: str = Query(...)

class UpdateGameFunding(BaseModel):
    game_id: str = Query(...)
    initial_funding: int
    initial_player_balance: int

class Property(BaseModel):
    game_id: str
    property_id: int
    color: str
    player_index: int
    mining_capacity: int
    mining_income: int

class InvitedPlayer(BaseModel):
    id: str = Query(...)
    name: str = Query(...)

class GameInvite(BaseModel):
    game_id: str = Query(...)
    free_market_liquidity: Optional[int] = None
    initial_funding: Optional[int] = None
    initial_player_balance: Optional[int] = None
    max_players_count: int

class JoinGame(BaseModel):
    game_id: str = Query(...)
    user_id: str = Query(...)
    wallet_id: str = Query(...)
    player_index: Optional[int] = None
    player_name: str = Query(...)

class InitializeCards(BaseModel):
    game_id: str = Query(...)
    technology_cards_max_index: int
    black_swan_cards_max_index: int

class Card(BaseModel):
    game_id: str = Query(...)
    card_type: str = Query(...)
    ids: str = Query(...)
    card_index: int
    max_index: int

class PickCard(BaseModel):
    game_id: str = Query(...)
    card_type: str = Query(...)
    player_index: int

class PlayerIndex(BaseModel):
    game_id: str = Query(...)
    player_index: int

class GetPayLink(BaseModel):
    game_id: str = Query(...)
    pay_link_player_index: int

class UpdatePropertyIncome(BaseModel):
    game_id: str
    player_index: int
    color: str
    property_id: int
    income_increment: int

class UpgradeMiners(BaseModel):
    game_id: str
    player_index: int
    color: str
    property_id: int

class UpdateCumulatedFines(BaseModel):
    game_id: str
    player_index: int
    fine: int
