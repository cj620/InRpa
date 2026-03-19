import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:8000/ws";

export function useWebSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState({});       // { scriptName: [lines] }
  const [statuses, setStatuses] = useState({}); // { scriptName: status }

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // auto reconnect
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "log") {
        setLogs((prev) => ({
          ...prev,
          [msg.script]: [...(prev[msg.script] || []), msg.data],
        }));
      } else if (msg.type === "status") {
        setStatuses((prev) => ({
          ...prev,
          [msg.script]: msg.data,
        }));
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const clearLogs = useCallback((scriptName) => {
    setLogs((prev) => ({ ...prev, [scriptName]: [] }));
  }, []);

  return { connected, logs, statuses, clearLogs };
}
