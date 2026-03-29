"use client";
import { X, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetConfig, WidgetKey } from "@/hooks/use-dashboard-widgets";

interface DashboardCustomizeProps {
  open: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onToggle: (key: WidgetKey) => void;
}

export function DashboardCustomize({ open, onClose, widgets, onToggle }: DashboardCustomizeProps) {
  if (!open) return null;

  const groups = {
    top: widgets.filter(w => w.section === "top"),
    main: widgets.filter(w => w.section === "main"),
    side: widgets.filter(w => w.section === "side"),
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-[81] w-80 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Customize Dashboard</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toggle widgets on/off to customize your dashboard.</p>

          {(["top", "main", "side"] as const).map(group => (
            <div key={group}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                {group === "top" ? "Top Bar" : group === "main" ? "Main Column" : "Side Column"}
              </h3>
              <div className="space-y-1">
                {groups[group].map(widget => (
                  <button
                    key={widget.key}
                    onClick={() => onToggle(widget.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      widget.enabled
                        ? "bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800"
                        : "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-5 rounded-full relative transition-colors flex-shrink-0",
                      widget.enabled ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-600"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        widget.enabled ? "translate-x-3.5" : "translate-x-0.5"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{widget.label}</p>
                      <p className="text-xs text-gray-400 truncate">{widget.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}