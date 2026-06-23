from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections by session ID."""
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket registered for session {session_id}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket unregistered for session {session_id}")

    async def send_personal_message(self, message: dict, session_id: str):
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending message to WebSocket for session {session_id}: {e}")

    async def broadcast(self, message: dict):
        for session_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send broadcast to session {session_id}: {e}")


manager = ConnectionManager()
