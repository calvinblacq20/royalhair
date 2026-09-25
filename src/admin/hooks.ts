import { useEffect, useRef, useState } from "react";
import { motionMode } from "../motion";

const seen = new Set<string>();

/** True the first time a key renders in this page load, so entrance animations and skeletons play once. */
export function useFirstVisit(key: string): boolean {
  const first = useRef(!seen.has(key)).current;
  useEffect(() => {
    seen.add(key);
  }, [key]);
  return first;
}

/** A short skeleton on the first visit to a screen, then straight to content on later visits. */
export function useFirstLoad(key: string, ms = 450): boolean {
  const first = useFirstVisit(`load:${key}`);
  const [loading, setLoading] = useState(first);
  useEffect(() => {
    if (!first) return;
    const timer = window.setTimeout(() => setLoading(false), motionMode() === "full" ? ms : 0);
    return () => window.clearTimeout(timer);
  }, [first, ms]);
  return loading;
}

/** The current time, refreshed every minute so "today" and "late" stay right on a screen left open. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Keeps a text input responsive while the URL (and the filtered list) catches up. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
