
"use client";

import { useState, useEffect } from 'react';

// Type guard to check if running in a browser environment
const isBrowser = typeof window !== 'undefined';

function getStorageValue<T>(key: string, defaultValue: T): T {
  // Getting stored value
  if (!isBrowser) {
    return defaultValue;
  }
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Error reading localStorage key “${key}”:`, error);
  }
  return defaultValue;
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    // Storing value
     if (!isBrowser) {
        return;
    }
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, value]);

  return [value, setValue];
}
