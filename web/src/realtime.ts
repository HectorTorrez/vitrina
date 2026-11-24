import { useEffect, useRef } from "react";

export type LiveTopic = "shop" | "bookings" | "orders";

export interface LiveEvent {
  shop: string;
  topics: LiveTopic[];
  at: number;
}

type Listener = (event: LiveEvent) => void;

interface SharedStream {
  source: EventSource | null;
  listeners: Set<Listener>;
  onVisible: () => void;
}

const streams = new Map<string, SharedStream>();

function openStream(url: string, entry: SharedStream) {
  if (entry.source || entry.listeners.size === 0) return;
  const es = new EventSource(url);
  entry.source = es;
  es.addEventListener("update", (raw) => {
    try {
      const parsed = JSON.parse((raw as MessageEvent<string>).data) as LiveEvent;
      if (parsed && typeof parsed.shop === "string" && Array.isArray(parsed.topics)) {
        for (const listener of entry.listeners) {
          listener(parsed);
        }
      }
    } catch {
      // Ignore malformed payloads.
    }
  });
}

function subscribeEventSource(url: string, onEventRef: { current: Listener }) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  let entry = streams.get(url);
  if (!entry) {
    entry = {
      source: null,
      listeners: new Set(),
      onVisible: () => {
        if (document.visibilityState === "visible" && entry!.source?.readyState === EventSource.CLOSED) {
          entry!.source = null;
          openStream(url, entry!);
        }
      },
    };
    streams.set(url, entry);
    document.addEventListener("visibilitychange", entry.onVisible);
  }

  const listener: Listener = (event) => onEventRef.current(event);
  entry.listeners.add(listener);
  openStream(url, entry);

  return () => {
    entry!.listeners.delete(listener);
    if (entry!.listeners.size === 0) {
      document.removeEventListener("visibilitychange", entry!.onVisible);
      entry!.source?.close();
      entry!.source = null;
      streams.delete(url);
    }
  };
}

/** Subscribes to live server-sent updates for a public shop (blocked dates, hours, catalog, bookings, stock). */
export function useShopRealtime(shop: string | undefined, onEvent: (event: LiveEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!shop) return;
    return subscribeEventSource("/eventos/tienda/" + encodeURIComponent(shop), callbackRef);
  }, [shop]);
}

/** Subscribes to live server-sent updates for all shops owned by the logged-in seller. */
export function usePanelRealtime(onEvent: (event: LiveEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    return subscribeEventSource("/eventos/panel", callbackRef);
  }, []);
}
