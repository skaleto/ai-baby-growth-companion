import { useEffect, useState } from "react";

export function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Browser storage can reject large media payloads; the app still works in-memory.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
