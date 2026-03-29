"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Timer, Plus, X } from "lucide-react";

/**
 * Mobile-only speed-dial FAB that replaces the stacking Focus + Friday FABs.
 * BUG-01 fix: prevents chart overlap by using a single FAB.
 * UX-10: Provides speed-dial expand behavior.
 * Hidden on desktop (lg+).
 */
export function MobileFAB() {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2">
      {/* Speed-dial options */}
      {expanded && (
        <>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("focus-timer:open-setup")); setExpanded(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-bottom-2"
          >
            <Timer className="w-4 h-4 text-green-500" />
            Focus
          </button>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("friday:open")); setExpanded(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-bottom-2"
          >
            <Sparkles className="w-4 h-4 text-violet-500" />
            Friday AI
          </button>
          <button
            onClick={() => { window.dispatchEvent(new CustomEvent("quick-capture:open")); setExpanded(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 animate-in fade-in slide-in-from-bottom-2"
          >
            <Plus className="w-4 h-4 text-blue-500" />
            Add Task
          </button>
        </>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn(
          "w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all",
          expanded
            ? "bg-gray-800 dark:bg-gray-200 rotate-45"
            : "bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700"
        )}
      >
        {expanded
          ? <X className="w-5 h-5 text-white dark:text-gray-800" />
          : <Sparkles className="w-5 h-5 text-white" />
        }
      </button>
    </div>
  );
}