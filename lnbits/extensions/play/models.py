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
    cumulated_fines: Optional[int] = 0
    player_turn: str
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
    player_index: str = Query(...)
    client_id: str = Query(...)
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)

class PlayerWallet(BaseModel):
    game_id: str = Query(...)
    is_free_market: bool
    player_index: str = Query(...)
    client_id: str = Query(...)
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)
    pay_link_id: Optional[str] = None
    pay_link: Optional[str] = None

class PlayerWalletInfo(BaseModel):
    game_id: str = Query(...)
    is_free_market: bool
    player_index: str = Query(...)
    balance_msat: Optional[int] = 0

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
    player_index: str = Query(...)
    player_name: str = Query(...)

class Player(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)
    player_name: str = Query(...)
    active: bool

class NewPlayerData(BaseModel):
    player_index: str = Query(...)
    name: str = Query(...)
    user: str = Query(...)
    id: str = Query(...)
    inkey: str = Query(...)
    adminkey: str = Query(...)

class UpdateWalletBalance(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)
    balance_msat: str = Query(...)

class WalletBalance(BaseModel):
   balance_msat: int

class CreateVoucher(BaseModel):
    game_id: str = Query(...)
    voucher_id: str = Query(...)

class UpdateGameFunding(BaseModel):
    game_id: str = Query(...)
    initial_funding: int
    initial_player_balance: int

class Property(BaseModel):
    game_id: str = Query(...)
    property_id: str = Query(...)
    color: str = Query(...)
    player_index: str = Query(...)
    mining_capacity: Optional[int] = 0
    mining_income: Optional[int] = 0

class InvitedPlayer(BaseModel):
    id: str = Query(...)
    client_id: str = Query(...)
    name: str = Query(...)

class GameInvite(BaseModel):
    game_id: str = Query(...)
    free_market_liquidity: Optional[int] = None
    initial_funding: Optional[int] = None
    initial_player_balance: Optional[int] = None
    max_players_count: int

class JoinGame(BaseModel):
    game_id: str = Query(...)
    client_id: str = Query(...)
    user_id: str = Query(...)
    wallet_id: str = Query(...)
    player_index: Optional[str] = None
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
    player_index: str = Query(...)

class PlayerIndex(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)

class GetPayLink(BaseModel):
    game_id: str = Query(...)
    pay_link_player_index: str = Query(...)

class UpdatePropertyIncome(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)
    color: str = Query(...)
    property_id: str = Query(...)
    income_increment: int

class UpgradeMiners(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)
    color: str = Query(...)
    property_id: str = Query(...)

class UpdateCumulatedFines(BaseModel):
    game_id: str = Query(...)
    player_index: str = Query(...)
    fine: int

class RewardClaim(BaseModel):
     game_id: str = Query(...)
     player_index: str = Query(...)
     amount: int
