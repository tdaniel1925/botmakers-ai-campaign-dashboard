"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GLOBAL_SHORTCUTS, useKeyboardShortcutsHelp } from "@/hooks/use-keyboard-shortcuts";
import { Keyboard } from "lucide-react";

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcutsHelp(() => setOpen(true));

  // Group shortcuts by category
  const groupedShortcuts = GLOBAL_SHORTCUTS.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, typeof GLOBAL_SHORTCUTS>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Available keyboard shortcuts in the application
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {category}
              </h4>
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border rounded">
                      {formatKeyCombo(shortcut.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">?</kbd> anytime
          to see this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatKeyCombo(combo: string): string {
  // Format for display (make it pretty)
  return combo
    .replace(/ctrl/gi, "Ctrl")
    .replace(/cmd/gi, "⌘")
    .replace(/meta/gi, "⌘")
    .replace(/shift/gi, "⇧")
    .replace(/alt/gi, "⌥")
    .replace(/escape/gi, "Esc")
    .replace(/enter/gi, "↵")
    .replace(/\+/g, " + ");
}
