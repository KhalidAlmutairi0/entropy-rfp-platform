import { useEffect, useRef, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";

interface SSEOptions {
  onMessage?: (data: unknown) => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
}

export function useSSE(url: string | null, options: SSEOptions = {}) {
  const { onMessage, onError, autoConnect = true } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Fix S-F2: Store callbacks in refs so the EventSource handlers always call the
  // current version, not the stale closure captured at connection time.
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    if (!url) return;
    const token = getToken();
    // Note: EventSource does not support custom headers (browser API limitation).
    // Token is passed as a query param. Use short-lived SSE-specific tokens when
    // available, or keep token expiry short to limit the exposure window.
    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.(data);
      } catch {
        onMessageRef.current?.(e.data);
      }
    };

    es.onerror = (e) => {
      setConnected(false);
      setError("انقطع الاتصال");
      onErrorRef.current?.(e);
    };
  }, [url]); // Only re-create when URL changes — callbacks use refs

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }
    return disconnect;
  }, [url, autoConnect, connect, disconnect]);

  return { connected, error, connect, disconnect };
}
