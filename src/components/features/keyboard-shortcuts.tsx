"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const SHORTCUTS = [
  { group: "Navigation", items: [
    { key: "D", desc: "Dashboard" },
    { key: "T", desc: "Today view" },
    { key: "U", desc: "Upcoming" },
    { key: "W", desc: "Weekly Review" },
    { key: "K", desc: "Kanban Board" },
    { key: "P", desc: "PM Workspace" },
    { key: "I", desc: "Integrations" },
    { key: "S", desc: "Settings" },
  ]},
  { group: "Actions", items: [
    { key: "N", desc: "New task (Quick Add)" },
    { key: "F", desc: "Start Focus session" },
    { key: "⌘K", desc: "Command palette" },
    { key: "/", desc: "Command palette" },
    { key: "?", desc: "Show shortcuts" },
    { key: "G", desc: "Ask Friday AI" },
    { key: "R", desc: "Weekly Review" },
  ]},
];

export function KeyboardShortcutsProvider() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInputFocused()) return;

      switch (e.key.toLowerCase()) {
        case "d":
          e.preventDefault();
          router.push("/dashboard");
          break;
        case "t":
          e.preventDefault();
          router.push("/today");
          break;
        case "u":
          e.preventDefault();
          router.push("/upcoming");
          break;
        case "w":
          e.preventDefault();
          router.push("/weekly");
          break;
        case "k":
          e.preventDefault();
          router.push("/kanban");
          break;
        case "p":
          e.preventDefault();
          router.push("/pm");
          break;
        case "i":
          e.preventDefault();
          router.push("/integrations");
          break;
        case "s":
          e.preventDefault();
          router.push("/settings");
          break;
        case "n":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("quick-capture:open"));
          break;
        case "f":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("focus-timer:open-setup"));
          break;
        case "g":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("friday:open"));
          break;
        case "r":
          e.preventDefault();
          router.push("/weekly");
          break;
        case "?":
          e.preventDefault();
          setShowHelp(v => !v);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, isInputFocused]);

  if (!showHelp) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {SHORTCUTS.map(group => (
              <div key={group.group}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">{group.group}</h3>
                <div className="space-y-1.5">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</span>
                      <kbd className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 text-center">Press <kbd className="px-1 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">?</kbd> to toggle</p>
          </div>
        </div>
      </div>
    </>
  );
}