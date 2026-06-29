import { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import useProctoringStore from '../store/proctoringStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function useWebSocket(sessionId) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const { token } = useAuthStore();
  const { addWarning, removeWarning } = useProctoringStore();

  const disconnect = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !token) return;
    
    disconnect(); // Ensure clean state before connecting

    const wsUrl = `${WS_URL}/ws/${sessionId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Proctoring WebSocket connected');

      // Start 30-second heartbeat to keep connection alive
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'integrity_alert') {
          const alert = message.payload;
          const warningMsg = alert.metadata?.message || `Behavior flag: ${alert.event_type}`;
          
          // Add warning to proctoring state
          addWarning(warningMsg);

          // Clear warnings after 5 seconds
          setTimeout(() => {
            removeWarning(warningMsg);
          }, 5000);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = (e) => {
      setIsConnected(false);
      console.log(`WebSocket closed: ${e.code} ${e.reason}`);
      
      // Auto-reconnect if not closed normally (1000) or by user
      if (e.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, [sessionId, token, disconnect, addWarning, removeWarning]);

  const sendSignal = useCallback((payload) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'behavioral_signal',
        payload,
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { isConnected, sendSignal, reconnect: connect };
}
