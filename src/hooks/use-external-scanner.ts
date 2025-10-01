
"use client";

import { useEffect, useState, useCallback } from 'react';

export function useExternalScanner(onScan: (code: string) => void) {
  const [input, setInput] = useState('');
  const [lastKeystroke, setLastKeystroke] = useState(Date.now());

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Defensive check to ensure e.key is not undefined, null, or empty
    if (!e.key) {
      return;
    }
    
    // Ignore modifier keys and other non-character keys
    if (e.key.length > 1 && e.key !== 'Enter') {
      return;
    }

    const currentTime = Date.now();
    // Reset if there's a long pause between keystrokes (e.g., more than 100ms)
    // This helps differentiate between fast scanner input and manual typing.
    if (currentTime - lastKeystroke > 100) {
      setInput(e.key === 'Enter' ? '' : e.key);
      setLastKeystroke(currentTime);
      return;
    }

    if (e.key === 'Enter') {
      if (input.length > 2) { // Typically QR codes are longer than 2 chars
        onScan(input);
      }
      setInput('');
    } else {
      setInput(prev => prev + e.key);
    }
    setLastKeystroke(currentTime);

  }, [input, onScan, lastKeystroke]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
