import asyncio
import json
import time

from threading import Thread

from lnbits.core.models import Payment
from lnbits.core.crud import (
    get_wallet,
    get_wallet_payment,
    get_payments
)
from lnbits.helpers import get_current_extension_name
from lnbits.tasks import catch_everything_and_restart
from lnbits.tasks import register_invoice_listener

from .models import (
    WalletBalance,
    UpdateWalletBalance,
    PlayerWalletInfo,
    PlayerWallet
)
from .websocket import WebsocketManager

from loguru import logger

# Define crud functions here to avoid circular import : __init__ <-- tasks <-- crud <-- __init__
async def get_other_player_wallets(db, game_id: str, player_index: str) -> [PlayerWallet]:
    rows = await db.fetchall("SELECT * FROM difficulty.wallets WHERE game_id = ? AND player_index <> ?", (game_id, player_index))
    return[PlayerWallet(**row) for row in rows]

async def update_wallet_balance(db, data: UpdateWalletBalance) -> WalletBalance:
    await db.execute(
            """
            UPDATE difficulty.wallets SET balance_msat = ? WHERE game_id = ? AND player_index = ?
           """,
           (data.balance_msat, data.game_id, data.player_index),
    )

async def get_player_wallet_info(db, wallet_id: str) -> PlayerWalletInfo:
    row = await db.fetchone("SELECT * FROM difficulty.wallets WHERE id = ?", (wallet_id))
    return PlayerWalletInfo(**row) if row else None


class PaymentsWatcher:
    def __init__(self, db, websocketManager: WebsocketManager):
        self.websocketManager = websocketManager
        self.db = db
        self.lastChecked = time.time()
        self.thread: Thread

    def create_tasks(self):
        # Invoices coming from the backend Lightning node are already queued in the main event loop by lnbits invoice_listener
        # Create first task in the main event loop to read invoices
        loop = asyncio.get_event_loop()
        loop.create_task(catch_everything_and_restart(self.wait_for_paid_invoices))
        # Create second task in a separate thread to watch for outgoing payments
        self.thread: Thread = Thread(target = self.outgoing_payments_loop)
        self.thread.daemon = True
        self.thread.start()

    # Loop to update players balances on payments made by player wallets to other wallets outside of the game
    def outgoing_payments_loop(self):
        asyncio.new_event_loop().run_until_complete(
            catch_everything_and_restart(self.wait_for_outgoing_payments)
        )

    async def wait_for_outgoing_payments(self):
        while True:
            payments = await get_payments(complete=True, outgoing=True, since=self.lastChecked)
            for payment in payments:
                await self.on_outgoing_payment(payment)
            self.lastChecked = time.time()
            time.sleep(5)

    async def on_outgoing_payment(self, payment: Payment) -> None:
        # Check if payment.wallet_id is a player (or free market) wallet
        player_wallet = await get_player_wallet_info(self.db, payment.wallet_id)

        if(player_wallet):
            # Update player wallet balance
            await self.update_player_wallet_balance(player_wallet.game_id, player_wallet.player_index, payment.wallet_id)

    # Loop to update players balances on paid player wallets invoices
    async def wait_for_paid_invoices(self):
        invoice_queue = asyncio.Queue()
        register_invoice_listener(invoice_queue, get_current_extension_name())

        while True:
            payment = await invoice_queue.get()
            await self.on_invoice_paid(payment)


    async def on_invoice_paid(self, payment: Payment) -> None:
        # Check if payment.wallet_id is a player (or free market) wallet
        player_wallet = await get_player_wallet_info(self.db, payment.wallet_id)

        if(player_wallet):
            # Update player wallet balance
            await self.update_player_wallet_balance(player_wallet.game_id, player_wallet.player_index, payment.wallet_id)

            # Check if payment was sent by another player wallet
            other_wallets = await get_other_player_wallets(self.db, player_wallet.game_id, player_wallet.player_index)
            for other_wallet in other_wallets:
                from_payment = await get_wallet_payment(other_wallet.id, payment.payment_hash)
                if(from_payment):
                    # Update other player wallet balance
                    other_player_wallet = await get_player_wallet_info(self.db, from_payment.wallet_id)
                    await self.update_player_wallet_balance(other_player_wallet.game_id, other_player_wallet.player_index, from_payment.wallet_id)

        else:
            # not a player wallet
            return

    async def update_player_wallet_balance(self, game_id: str , player_index: str, wallet_id: str):
        # Check wallet balance
        wallet = await get_wallet(wallet_id)
        wallet_balance_msat = wallet.balance_msat
        # Update player wallet balance
        data = UpdateWalletBalance(
            game_id=game_id,
            player_index=player_index,
            balance_msat=wallet_balance_msat
        )
        await update_wallet_balance(self.db, data)

        # Notify all game players
        msg = json.dumps({
            "type": "new_payment",
            "player_index": player_index,
            "balance_msat": wallet_balance_msat
        })
        await self.websocketManager.notify_all_game_players(game_id, msg)