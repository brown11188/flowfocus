"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Clock, Plus, Timer, X, GripVertical, Loader2 } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isToday, isOverdue } from "@/lib/utils";
import { useFocusTimer } from "./focus-timer-context";
import { getTodayStrInTz } from "@/lib/timezone";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { Task } from "@/types";

interface TimeBlock {
  id: string;
  taskId?: string | null;
  title: string;
  startTime: string; // HH:mm
  endTime: string;
  date: string;
  color: string;
  note?: string | null;
  isCalendarEvent?: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am - 8pm
const SLOT_HEIGHT = 60; // px per hour

const BLOCK_COLORS: Record<string, string> = {
  violet: "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/50 dark:border-violet-700 dark:text-violet-300",
  blue: "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300",
  green: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300",
  amber: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/50 dark:border-amber-700 dark:text-amber-300",
  calendar: "bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-950/50 dark:border-violet-800 dark:text-violet-400",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function TimelineView() {
  const { tasks, updateTask } = useTaskStore();
  const { timezone } = useTimezoneCtx();
  const { startFocus } = useFocusTimer();
  const todayStr = getTodayStrInTz(timezone);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddSlot, setQuickAddSlot] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [blockDuration, setBlockDuration] = useState(30);

  const todayTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isToday(t.dueDate, timezone) && !t.parentId),
    [tasks, timezone]
  );
  const overdueTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && !t.completed && t.dueDate && isOverdue(t.dueDate, timezone)),
    [tasks, timezone]
  );

  // Tasks not yet blocked
  const blockedTaskIds = new Set(timeBlocks.filter(b => b.taskId).map(b => b.taskId!));
  const unblockedTasks = [...todayTasks, ...overdueTasks].filter(t => !blockedTaskIds.has(t.id));

  // Load time blocks
  const loadBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/time-blocks?date=${todayStr}`);
      if (res.ok) setTimeBlocks(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [todayStr]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // Create time block from task
  const handleTaskDrop = async (task: Task, hourSlot: number) => {
    const startTime = minutesToTime(hourSlot * 60);
    const endTime = minutesToTime(hourSlot * 60 + 30);
    try {
      const res = await apiFetch("/api/time-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, title: task.title, startTime, endTime, date: todayStr, color: "violet" }),
      });
      if (res.ok) {
        const block = await res.json();
        setTimeBlocks(prev => [...prev, block]);
        toast.success("Time block created");
      }
    } catch { toast.error("Failed to create block"); }
  };

  // Quick add block
  const handleQuickAdd = async () => {
    if (!quickAddTitle.trim() || quickAddSlot === null) return;
    const startTime = minutesToTime(quickAddSlot);
    const endTime = minutesToTime(quickAddSlot + 30);
    try {
      const res = await apiFetch("/api/time-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: quickAddTitle, startTime, endTime, date: todayStr, color: "blue" }),
      });
      if (res.ok) {
        const block = await res.json();
        setTimeBlocks(prev => [...prev, block]);
        setQuickAddSlot(null);
        setQuickAddTitle("");
      }
    } catch { toast.error("Failed to create block"); }
  };

  // Delete block
  const handleDeleteBlock = async (id: string) => {
    setTimeBlocks(prev => prev.filter(b => b.id !== id));
    await apiFetch(`/api/time-blocks/${id}`, { method: "DELETE" });
    setSelectedBlock(null);
  };

  // Update block duration
  const handleUpdateDuration = async (block: TimeBlock, newDuration: number) => {
    const startMins = timeToMinutes(block.startTime);
    const newEndTime = minutesToTime(startMins + newDuration);
    try {
      const res = await apiFetch(`/api/time-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endTime: newEndTime }),
      });
      if (res.ok) {
        setTimeBlocks(prev => prev.map(b => b.id === block.id ? { ...b, endTime: newEndTime } : b));
        setSelectedBlock(null);
      }
    } catch { toast.error("Failed to update"); }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar — unblocked tasks */}
      <div className="w-[30%] min-w-[200px] flex-shrink-0 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Unblocked Tasks</h3>
        {unblockedTasks.length === 0 ? (
          <p className="text-xs text-gray-400">All tasks have time blocks!</p>
        ) : (
          <div className="space-y-1.5">
            {unblockedTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("taskId", task.id);
                  e.dataTransfer.setData("taskTitle", task.title);
                }}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-grab hover:shadow-sm transition-shadow text-sm"
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate text-gray-700 dark:text-gray-300">{task.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — timeline */}
      <div className="flex-1 overflow-y-auto relative border-l border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
          </div>
        ) : (
          <div className="relative" style={{ minHeight: HOURS.length * SLOT_HEIGHT }}>
            {HOURS.map(hour => {
              const top = (hour - 7) * SLOT_HEIGHT;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                  style={{ top }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    const taskId = e.dataTransfer.getData("taskId");
                    const task = tasks.find(t => t.id === taskId);
                    if (task) handleTaskDrop(task, hour);
                  }}
                  onClick={() => { setQuickAddSlot(hour * 60); setQuickAddTitle(""); }}
                >
                  <span className="absolute -top-3 -left-0 pl-2 text-[10px] text-gray-400 font-medium">
                    {formatTime12(`${String(hour).padStart(2, "0")}:00`)}
                  </span>
                </div>
              );
            })}

            {/* Time blocks */}
            {timeBlocks.map(block => {
              const startMins = timeToMinutes(block.startTime);
              const endMins = timeToMinutes(block.endTime);
              const top = ((startMins - 7 * 60) / 60) * SLOT_HEIGHT;
              const height = ((endMins - startMins) / 60) * SLOT_HEIGHT;
              const colorClass = block.isCalendarEvent ? BLOCK_COLORS.calendar : (BLOCK_COLORS[block.color] || BLOCK_COLORS.violet);

              return (
                <div
                  key={block.id}
                  className={cn(
                    "absolute left-12 right-2 rounded-lg border px-2 py-1 text-xs cursor-pointer overflow-hidden transition-shadow hover:shadow-md",
                    colorClass
                  )}
                  style={{ top: Math.max(top, 0), height: Math.max(height, 20), minHeight: 20 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedBlock(block); }}
                >
                  <div className="font-medium truncate">{block.title}</div>
                  <div className="opacity-70 text-[10px]">{formatTime12(block.startTime)} – {formatTime12(block.endTime)}</div>
                  {!block.isCalendarEvent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startFocus(block.taskId || null, block.title, Math.round((endMins - startMins))); }}
                      className="mt-0.5 flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <Timer className="w-3 h-3" /> Focus now
                    </button>
                  )}
                </div>
              );
            })}

            {/* Quick add overlay */}
            {quickAddSlot !== null && (
              <div
                className="absolute left-12 right-2 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-violet-400 p-2 shadow-lg z-10"
                style={{ top: ((quickAddSlot - 7 * 60) / 60) * SLOT_HEIGHT }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={quickAddTitle}
                    onChange={e => setQuickAddTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); if (e.key === "Escape") setQuickAddSlot(null); }}
                    placeholder="Block title..."
                    className="flex-1 text-sm bg-transparent outline-none dark:text-white placeholder-gray-400"
                  />
                  <button onClick={handleQuickAdd} className="p-1 rounded bg-violet-600 text-white hover:bg-violet-700">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={() => setQuickAddSlot(null)} className="p-1 rounded text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Block popover */}
        {selectedBlock && !selectedBlock.isCalendarEvent && (
          <div className="fixed inset-0 z-50" onClick={() => setSelectedBlock(null)}>
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-4 w-64"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedBlock.title}</h4>
                <button onClick={() => setSelectedBlock(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {formatTime12(selectedBlock.startTime)} – {formatTime12(selectedBlock.endTime)}
              </p>
              <div className="flex gap-2 mb-3">
                {[15, 30, 45, 60, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => handleUpdateDuration(selectedBlock, d)}
                    className="px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-700 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
                  >
                    {d}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startFocus(selectedBlock.taskId || null, selectedBlock.title, Math.round((timeToMinutes(selectedBlock.endTime) - timeToMinutes(selectedBlock.startTime))))}
                  className="flex-1 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700"
                >
                  Focus Now
                </button>
                <button
                  onClick={() => handleDeleteBlock(selectedBlock.id)}
                  className="py-1.5 px-3 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
