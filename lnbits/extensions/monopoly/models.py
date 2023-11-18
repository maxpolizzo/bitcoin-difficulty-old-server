from pydantic import BaseModel
from fastapi.param_functions import Query
from typing import Optional

class CreateGameData(BaseModel):
    game_id: str = Query(...)
    admin_user_id: str = Query(...)
    max_players_count: int
    cumulated_fines: int
    available_player_names: str =  Query(...)

class CreateFirstPlayerData(BaseModel):
    game_id: str = Query(...)
    user_id: str = Query(...)

class UpdateFirstPlayerData(BaseModel):
    game_id: str = Query(...)
    player_wallet_id: str = Query(...)

class UpdateFirstPlayerName(BaseModel):
    player_wallet_id: str = Query(...)
    player_wallet_name: str = Query(...)

class UpdatePlayerName(BaseModel):
    player_wallet_id: str = Query(...)
    player_wallet_name: str = Query(...)

class UpdateMarketLiquidityData(BaseModel):
    game_id: str = Query(...)
    balance: int

class UpdateGameFundingData(BaseModel):
    game_id: str = Query(...)
    initial_funding: int
    initial_player_balance: int

class StartGameData(BaseModel):
   game_id: str = Query(...)
   started: bool

class UpdateVoucherData(BaseModel):
    game_id: str = Query(...)
    voucher_id: str = Query(...)

class UpdateGamePayLinkData(BaseModel):
    game_id: str = Query(...)
    pay_link_id: str = Query(...)
    pay_link: str = Query(...)

class UpdateGameInvoiceData(BaseModel):
    game_id: str = Query(...)
    payment_req: str = Query(...)
    payment_hash : str = Query(...)

class UpdatePlayerBalance(BaseModel):
    player_wallet_id: str = Query(...)
    player_balance: int

class CreatePlayerData(BaseModel):
    player_index: int
    player_user_id: str = Query(...)
    player_wallet_id: str = Query(...)
    player_wallet_name: str = Query(...)
    player_wallet_inkey: str = Query(...)
    player_balance: int
    game_id: str = Query(...)

class JoinPlayerData(BaseModel):
    game_id: str = Query(...)
    player_user_id: str = Query(...)
    player_wallet_id: str = Query(...)
    player_wallet_name: str = Query(...)
    player_wallet_inkey: str = Query(...)

class InvitePlayerData(BaseModel):
    game_id: str = Query(...)

class Game(BaseModel):
    game_id: str = Query(...)
    admin_user_id: str = Query(...)
    max_players_count: int
    player_turn: int

class MarketLiquidity(BaseModel):
    market_liquidity: int

class PlayerBalance(BaseModel):
   player_balance: int

class GameFunding(BaseModel):
    initial_funding: int
    initial_player_balance: int

class GameStarted(BaseModel):
    started: bool

class Voucher(BaseModel):
    voucher_id: str = Query(...)

class PayLink(BaseModel):
    pay_link_id: str = Query(...)
    pay_link: str = Query(...)

class Invoice(BaseModel):
    payment_req: str = Query(...)
    payment_hash : str = Query(...)

class GameWithPayLink(BaseModel):
    game_id: str = Query(...)
    admin_user_id: str = Query(...)
    initial_funding: int
    initial_player_balance: int
    max_players_count: int
    pay_link_id: str = Query(...)
    pay_link: str = Query(...)

class GameWithInvoice(BaseModel):
    game_id: str = Query(...)
    admin_user_id: str = Query(...)
    payment_req: str = Query(...)
    payment_hash : str = Query(...)

class Player(BaseModel):
    player_index: str
    player_user_id: str
    player_wallet_id: str
    player_wallet_name: str
    player_wallet_inkey: str
    player_balance: int
    game_id: str

class Property(BaseModel):
    property_id: int
    property_color: str
    property_owner_id: str
    property_mining_capacity: int
    property_mining_income: int
    game_id: str

class UpdatePropertyOwner(BaseModel):
    game_id: str
    property_color: str
    property_id: int
    new_owner: str

class UpdatePropertyIncome(BaseModel):
    game_id: str
    property_color: str
    property_id: int
    income_increment: int

class UpgradeProperty(BaseModel):
    game_id: str
    property_color: str
    property_id: int

class CardIndex(BaseModel):
    game_id: str
    card_type: str
    next_index: int
    player_index: int

class InitCardsIndex(BaseModel):
    game_id: str

class UpdateCardIndex(BaseModel):
    game_id: str
    card_type: str

class UpdateCumulatedFines(BaseModel):
    game_id: str
    fine: int

class CumulatedFines(BaseModel):
    game_id: str
    cumulated_fines: int

class ResetCumulatedFines(BaseModel):
    game_id: str

class UpdatePlayerPayLink(BaseModel):
    player_wallet_id: str
    player_pay_link_id: str
    player_pay_link: str

class PlayerPayLink(BaseModel):
    player_pay_link_id: str
    player_pay_link: str

class IncrementPlayerTurn(BaseModel):
    game_id: str
