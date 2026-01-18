import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["Ctrl", "T"], description: "Open new tab" },
  { keys: ["Ctrl", "W"], description: "Close current tab" },
  { keys: ["Ctrl", "Tab"], description: "Switch to next tab" },
  { keys: ["Ctrl", "Shift", "Tab"], description: "Switch to previous tab" },
  { keys: ["Ctrl", "L"], description: "Focus address bar" },
  { keys: ["Ctrl", "R"], description: "Refresh/reload page" },
  { keys: ["Ctrl", "D"], description: "Bookmark current page" },
  { keys: ["Ctrl", "B"], description: "Open bookmarks manager" },
  { keys: ["Ctrl", "H"], description: "Open browsing history" },
  { keys: ["?"], description: "Show this help overlay" },
  { keys: ["F1"], description: "Show this help overlay" },
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-effect">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex}>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded-md shadow-sm">
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="mx-1 text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">Esc</kbd> to close
        </p>
      </DialogContent>
    </Dialog>
  );
}
