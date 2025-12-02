"use client";

import { useEffect, useCallback, useRef } from "react";

type KeyCombo = string; // e.g., "Escape", "ctrl+s", "cmd+k"
type ShortcutHandler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
  key: KeyCombo;
  handler: ShortcutHandler;
  description?: string;
  preventDefault?: boolean;
  enableInInputs?: boolean;
}

/**
 * Parse a key combo string into its components
 */
function parseKeyCombo(combo: string): {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
} {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];

  return {
    key,
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta") || parts.includes("cmd"),
  };
}

/**
 * Check if an event matches a key combo
 */
function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const { key, ctrl, shift, alt, meta } = parseKeyCombo(combo);

  const eventKey = event.key.toLowerCase();
  const comboKey = key.toLowerCase();

  // Handle special keys
  const keyMatches =
    eventKey === comboKey ||
    (comboKey === "escape" && eventKey === "escape") ||
    (comboKey === "esc" && eventKey === "escape") ||
    (comboKey === "enter" && eventKey === "enter") ||
    (comboKey === "space" && eventKey === " ") ||
    (comboKey === "tab" && eventKey === "tab") ||
    (comboKey === "backspace" && eventKey === "backspace") ||
    (comboKey === "delete" && eventKey === "delete");

  return (
    keyMatches &&
    event.ctrlKey === ctrl &&
    event.shiftKey === shift &&
    event.altKey === alt &&
    event.metaKey === meta
  );
}

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  const isInput =
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable;

  return isInput;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcutsRef.current) {
        if (matchesKeyCombo(event, shortcut.key)) {
          // Skip if in input and not enabled for inputs
          if (!shortcut.enableInInputs && isInputElement(event.target)) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          shortcut.handler(event);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/**
 * Hook for a single Escape key handler (common pattern)
 */
export function useEscapeKey(handler: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handler, enabled]);
}

/**
 * Hook for command palette shortcut (Cmd+K / Ctrl+K)
 */
export function useCommandPalette(handler: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handler]);
}

/**
 * Hook for save shortcut (Cmd+S / Ctrl+S)
 */
export function useSaveShortcut(handler: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handler, enabled]);
}

/**
 * Global keyboard shortcuts context for showing available shortcuts
 */
export interface GlobalShortcut {
  key: string;
  description: string;
  category?: string;
}

export const GLOBAL_SHORTCUTS: GlobalShortcut[] = [
  { key: "Escape", description: "Close modal/dialog", category: "Navigation" },
  { key: "Ctrl+K", description: "Open command palette", category: "Navigation" },
  { key: "Ctrl+S", description: "Save current form", category: "Actions" },
  { key: "?", description: "Show keyboard shortcuts", category: "Help" },
];

/**
 * Hook for showing keyboard shortcuts help dialog
 */
export function useKeyboardShortcutsHelp(onShow: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show help with ? key (not in input)
      if (event.key === "?" && !isInputElement(event.target)) {
        event.preventDefault();
        onShow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onShow]);
}
