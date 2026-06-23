import logging
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.db.database import async_session_factory
from app.services.websocket_manager import manager
from app.services.integrity_engine import process_behavioral_signal
from app.services.auth_service import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str | None = Query(None),
):
    """
    WebSocket endpoint for real-time behavioral signal streaming.
    Authenticates token passed via query parameter.
    """
    # Validate session_id format
    try:
        parsed_session_id = UUID(session_id)
    except ValueError:
        await websocket.close(code=4000, reason="Invalid session ID format")
        return

    # Authenticate token
    if not token:
        await websocket.close(code=4008, reason="Missing authentication token")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4003, reason="Invalid or expired token")
        return

    # Accept connection and register in manager
    await manager.connect(session_id, websocket)

    try:
        while True:
            # Read incoming JSON
            data = await websocket.receive_json()

            if data.get("type") == "behavioral_signal":
                payload = data.get("payload", {})
                
                # Create a database session to process and store events
                async with async_session_factory() as db:
                    try:
                        await process_behavioral_signal(parsed_session_id, payload, db)
                        await db.commit()
                    except Exception as e:
                        await db.rollback()
                        logger.error(f"Error processing signal: {e}", exc_info=True)

            elif data.get("type") == "heartbeat":
                await websocket.send_json({"type": "ack"})

            else:
                logger.warning(f"Unknown message type received: {data.get('type')}")

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        logger.error(f"WebSocket error in session {session_id}: {e}", exc_info=True)
        manager.disconnect(session_id)
