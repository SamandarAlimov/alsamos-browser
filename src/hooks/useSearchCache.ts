import { useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface SearchCacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_SIZE = 50;

export function useSearchCache<T>(options: SearchCacheOptions = {}) {
  const { ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE } = options;
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

  const generateKey = useCallback((query: string, type: string): string => {
    return `${type}:${query.toLowerCase().trim()}`;
  }, []);

  const get = useCallback((query: string, type: string): T | null => {
    const key = generateKey(query, type);
    const entry = cacheRef.current.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > ttl) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return entry.data;
  }, [generateKey, ttl]);

  const set = useCallback((query: string, type: string, data: T): void => {
    const key = generateKey(query, type);
    
    // Evict oldest entries if at capacity
    if (cacheRef.current.size >= maxSize) {
      const oldestKey = cacheRef.current.keys().next().value;
      if (oldestKey) {
        cacheRef.current.delete(oldestKey);
      }
    }
    
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, [generateKey, maxSize]);

  const clear = useCallback((): void => {
    cacheRef.current.clear();
  }, []);

  const has = useCallback((query: string, type: string): boolean => {
    return get(query, type) !== null;
  }, [get]);

  return { get, set, clear, has };
}

// Debounce hook for instant search
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}
