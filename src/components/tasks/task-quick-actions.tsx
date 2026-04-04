"use client";
import { useState, useRef, useEffect } from "react";
import { Calendar, Flag, FolderOpen, Timer, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";

interface TaskQuickActionsProps {
  taskId: string;
  currentPriority: number;
  currentDueDate?: string | null;
  currentProjectId?: string | null;
  onEdit: (id: string, data: Record<string, unknown>) => void;
  visible: boolean;
}

const PRIORITIES = [
  { value: 1, label: "P1", color: "text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
  { value: 2, label: "P2", color: "text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" },
  { value: 3, label: "P3", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  { value: 4, label: "P4", color: "text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700" },
];

export function TaskQuickActions({ taskId, currentPriority, currentDueDate, currentProjectId, onEdit, visible }: TaskQuickActionsProps) {
  const [activePicker, setActivePicker] = useState<"priority" | "date" | "project" | "recurrence" | null>(null);
  const { projects } = useTaskStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) setActivePicker(null);
  }, [visible]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    };
    if (activePicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePicker]);

  if (!visible && !activePicker) return null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-0.5">
      {/* Due date */}
      <button
        onClick={(e) => { e.stopPropagation(); setActivePicker(activePicker === "date" ? null : "date"); }}
        className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
        title="Set due date"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>

      {/* Priority */}
      <button
        onClick={(e) => { e.stopPropagation(); setActivePicker(activePicker === "priority" ? null : "priority"); }}
        className="p-1 rounded-md text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors"
        title="Set priority"
      >
        <Flag className="w-3.5 h-3.5" />
      </button>

      {/* Move to project */}
      <button
        onClick={(e) => { e.stopPropagation(); setActivePicker(activePicker === "project" ? null : "project"); }}
        className="p-1 rounded-md text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
        title="Move to project"
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </button>

      {/* Focus */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("focus-timer:open-setup"));
        }}
        className="p-1 rounded-md text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
        title="Start focus session"
      >
        <Timer className="w-3.5 h-3.5" />
      </button>

      {/* FEAT-02: Set recurrence */}
      <button
        onClick={(e) => { e.stopPropagation(); setActivePicker(activePicker === "recurrence" ? null : "recurrence"); }}
        className="p-1 rounded-md text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
        title="Set recurrence"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      {/* Priority Picker Popover */}
      {activePicker === "priority" && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[120px]">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={(e) => { e.stopPropagation(); onEdit(taskId, { priority: p.value }); setActivePicker(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                currentPriority === p.value
                  ? p.color + " border"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <Flag className={cn("w-3 h-3", p.value === 1 ? "text-red-500" : p.value === 2 ? "text-orange-500" : p.value === 3 ? "text-blue-500" : "text-gray-400")} />
              {p.label}
              {currentPriority === p.value && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Date Picker Popover */}
      {activePicker === "date" && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[160px]">
          <div className="space-y-1">
            {[
              { label: "Today", value: () => { const d = new Date(); d.setHours(12,0,0,0); return d.toISOString(); } },
              { label: "Tomorrow", value: () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(12,0,0,0); return d.toISOString(); } },
              { label: "Next week", value: () => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(12,0,0,0); return d.toISOString(); } },
              { label: "No date", value: () => null },
            ].map(opt => (
              <button
                key={opt.label}
                onClick={(e) => { e.stopPropagation(); onEdit(taskId, { dueDate: opt.value() }); setActivePicker(null); }}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {opt.label}
              </button>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-1 mt-1">
              <input
                type="date"
                defaultValue={currentDueDate?.split("T")[0] ?? ""}
                onChange={(e) => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + "T12:00:00");
                    onEdit(taskId, { dueDate: d.toISOString() });
                    setActivePicker(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-transparent dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Project Picker Popover */}
      {activePicker === "project" && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[160px] max-h-48 overflow-y-auto">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={(e) => { e.stopPropagation(); onEdit(taskId, { projectId: p.id }); setActivePicker(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                currentProjectId === p.id
                  ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
              {currentProjectId === p.id && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Recurrence Picker Popover */}
      {activePicker === "recurrence" && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 min-w-[140px]">
          {[
            { label: "🔁 Daily", value: "DAILY" },
            { label: "📅 Weekly", value: "WEEKLY" },
            { label: "🗓️ Monthly", value: "MONTHLY" },
            { label: "❌ No recurrence", value: null },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(taskId, {
                  recurrenceRule: opt.value,
                  recurrenceInterval: opt.value ? 1 : null,
                });
                setActivePicker(null);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}