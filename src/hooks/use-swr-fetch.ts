"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const CACHE_PREFIX = "flowfocus_swr_";
const DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes

interface SWRState<T> {
  data: T | null;
  isLoading: boolean;
  isRevalidating: boolean;
  error: string | null;
  revalidate: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * TECH-01: Stale-while-revalidate fetch hook
 * Shows cached data immediately, revalidates in background.
 */
export function useSWRFetch<T>(
  path: string,
  options?: {
    maxAge?: number; // ms before cache is considered stale (default 5min)
    fallback?: T;
    enabled?: boolean;
    fetchInit?: RequestInit;
  }
): SWRState<T> {
  const { maxAge = DEFAULT_MAX_AGE, fallback = null, enabled = true, fetchInit } = options || {};
  const cacheKey = CACHE_PREFIX + path;
  
  const [data, setData] = useState<T | null>(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.data as T;
      }
    } catch { /* ignore */ }
    return fallback;
  });
  const [isLoading, setIsLoading] = useState(!data);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return new Date(JSON.parse(cached).timestamp);
    } catch { /* ignore */ }
    return null;
  });
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (isBackground: boolean) => {
    if (!enabled) return;
    if (isBackground) setIsRevalidating(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch(path, fetchInit);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!mountedRef.current) return;
      
      setData(json);
      const now = new Date();
      setLastUpdated(now);
      
      // Persist to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: json, timestamp: now.toISOString() }));
      } catch { /* storage full */ }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      if (!mountedRef.current) return;
      if (isBackground) setIsRevalidating(false);
      else setIsLoading(false);
    }
  }, [path, enabled, cacheKey, fetchInit]);

  // On mount: if we have cached data, revalidate in background; otherwise load fresh
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    const isCacheStale = () => {
      if (!lastUpdated) return true;
      return Date.now() - lastUpdated.getTime() > maxAge;
    };

    if (data && !isCacheStale()) {
      // Cache is fresh — no fetch needed
      setIsLoading(false);
      return;
    }

    if (data) {
      // Have stale cache — show it, revalidate in background
      setIsLoading(false);
      fetchData(true);
    } else {
      // No cache — full load
      fetchData(false);
    }

    return () => { mountedRef.current = false; };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const revalidate = useCallback(async () => {
    await fetchData(!!data);
  }, [fetchData, data]);

  return { data, isLoading, isRevalidating, error, revalidate, lastUpdated };
}
