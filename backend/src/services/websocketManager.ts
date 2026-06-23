import { WebSocket } from 'ws';

export class ConnectionManager {
  private activeConnections: Map<string, WebSocket> = new Map();

  public connect(sessionId: string, websocket: WebSocket) {
    this.activeConnections.set(sessionId, websocket);
    console.log(`WebSocket registered for session ${sessionId}`);
  }

  public disconnect(sessionId: string) {
    if (this.activeConnections.has(sessionId)) {
      this.activeConnections.delete(sessionId);
      console.log(`WebSocket unregistered for session ${sessionId}`);
    }
  }

  public sendPersonalMessage(message: any, sessionId: string) {
    const websocket = this.activeConnections.get(sessionId);
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      try {
        websocket.send(JSON.stringify(message));
      } catch (err) {
        console.warn(`Error sending message to WebSocket for session ${sessionId}:`, err);
      }
    }
  }

  public broadcast(message: any) {
    const payload = JSON.stringify(message);
    for (const [sessionId, connection] of this.activeConnections.entries()) {
      if (connection.readyState === WebSocket.OPEN) {
        try {
          connection.send(payload);
        } catch (err) {
          console.warn(`Failed to send broadcast to session ${sessionId}:`, err);
        }
      }
    }
  }
}

export const wsManager = new ConnectionManager();
export default wsManager;
