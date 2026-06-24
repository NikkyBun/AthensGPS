import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

/** A saved line. Same shape as the line a user picks on the map, so opening a
 *  favorite is literally "search this line". */
export type FavoriteLine = { lineCode: string; lineId: string; descr: string };

const STORAGE_KEY = "athensgps.favorites.v1";

/* Optional persistence. AsyncStorage is a native module; if it isn't part of the
 * running build (e.g. an OTA JS update landing on an older APK that didn't bundle
 * it), we silently fall back to in-memory favorites instead of crashing. */
let AsyncStorage: {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
} | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {
  AsyncStorage = null;
}

type FavoritesContextValue = {
  favorites: FavoriteLine[];
  /** true once the initial load from storage has settled. */
  ready: boolean;
  isFavorite: (lineCode: string) => boolean;
  toggleFavorite: (line: FavoriteLine) => void;
  removeFavorite: (lineCode: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteLine[]>([]);
  const [ready, setReady] = useState(false);

  // Load once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = AsyncStorage ? await AsyncStorage.getItem(STORAGE_KEY) : null;
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setFavorites(parsed as FavoriteLine[]);
        }
      } catch {
        // corrupt or unavailable storage → start empty
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change (skip the very first render, before load settles).
  useEffect(() => {
    if (!ready || !AsyncStorage) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)).catch(() => {});
  }, [favorites, ready]);

  const isFavorite = useCallback(
    (lineCode: string) => favorites.some((f) => f.lineCode === lineCode),
    [favorites],
  );

  const toggleFavorite = useCallback((line: FavoriteLine) => {
    setFavorites((prev) =>
      prev.some((f) => f.lineCode === line.lineCode)
        ? prev.filter((f) => f.lineCode !== line.lineCode)
        : [...prev, line],
    );
  }, []);

  const removeFavorite = useCallback((lineCode: string) => {
    setFavorites((prev) => prev.filter((f) => f.lineCode !== lineCode));
  }, []);

  return (
    <FavoritesContext.Provider
      value={{ favorites, ready, isFavorite, toggleFavorite, removeFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
