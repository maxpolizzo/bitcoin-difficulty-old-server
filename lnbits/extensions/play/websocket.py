from fastapi import WebSocket
from loguru import logger

# Define crud functions here to avoid circular import : __init__ <-- websocket <-- crud <-- __init__
async def get_client_ids(db, game_id: str) -> [str]:
    rows = await db.fetchall("SELECT client_id FROM difficulty.wallets WHERE game_id = ?", (game_id))
    return[row[0] for row in rows]

async def get_other_client_ids(db, game_id: str, player_index: str) -> [str]:
    rows = await db.fetchall("SELECT client_id FROM difficulty.wallets WHERE game_id = ? AND player_index <> ?", (game_id, player_index))
    return[row[0] for row in rows]

class WebsocketManager:
    def __init__(self, db):
        self.db = db
        self.active_connections = dict()

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        websocket = self.active_connections.get(client_id)
        if websocket:
            self.active_connections.pop(client_id)
            logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, client_id: str, message: str):
        websocket = self.active_connections.get(client_id)
        if websocket:
            logger.info(f"Sending ${message} to ${client_id}")
            await websocket.send_text(message)

    async def broadcast(self, message: str):
        for client_id in self.active_connections.keys():
            await self.active_connections.get(client_id).send_text(message)

    async def notify_all_game_players(self, game_id: str, msg: str):
        game_client_ids = await get_client_ids(self.db, game_id)
        for client_id in game_client_ids:
            if(client_id):
                await self.send_personal_message(client_id, msg)

    async def notify_other_game_players(self, game_id: str, player_index: str, msg: str):
            if(player_index == "1"):
                player_index = "0"
            game_client_ids = await get_other_client_ids(self.db, game_id, player_index)
            for client_id in game_client_ids:
                if(client_id):
                    await self.send_personal_message(client_id, msg)