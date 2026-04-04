"use client";
import { useState, useMemo } from "react";
import { Task } from "@/types";
import { cn, isOverdue, formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, Flag } from "lucide-react";
import { TaskItem } from "@/components/tasks/task-item";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { getTodayStrInTz, isToday as isTodayTz } from "@/lib/timezone";

interface Props {
  tasks: Task[];
  calendarEvents?: CalEvent[];
  onComplete: (id: string, v: boolean) => void;
  onEdit: (id: string, d: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

interface CalEvent {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  isAllDay?: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am-8pm

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function formatTime(dt: string): string {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

const PRIORITY_DOT: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-blue-500",
  4: "bg-gray-300 dark:bg-gray-600",
};

export function UpcomingWeekView({ tasks, calendarEvents = [], onComplete, onEdit, onDelete }: Props) {
  const { timezone } = useTimezoneCtx();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ dateStr: string; hour: number } | null>(null);

  const baseDate = useMemo(() => {
    const todayStr = getTodayStrInTz(timezone);
    const [y, m, d] = todayStr.split("-").map(Number);
    const today = new Date(y, m - 1, d);
    today.setDate(today.getDate() + weekOffset * 7);
    return today;
  }, [timezone, weekOffset]);

  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.filter(t => !t.isDeleted && t.dueDate && !t.parentId).forEach(t => {
      const d = new Date(t.dueDate!);
      const key = toDateStr(d);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    calendarEvents.forEach(ev => {
      const d = new Date(ev.startDateTime);
      const key = toDateStr(d);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [calendarEvents]);

  const rangeLabel = useMemo(() => {
    if (weekDays.length < 7) return "";
    const first = weekDays[0];
    const last = weekDays[6];
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${first.toLocaleDateString("en-US", opts)} – ${last.toLocaleDateString("en-US", opts)}`;
  }, [weekDays]);

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekOffset(0)} className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            weekOffset === 0 ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          )}>
            This Week
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-gray-400">{rangeLabel}</span>
      </div>

      {/* Week grid */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800">
          <div className="p-2" />
          {weekDays.map(day => {
            const dateStr = toDateStr(day);
            const today = isTodayTz(dateStr, timezone);
            return (
              <div key={dateStr} className={cn(
                "p-2 text-center border-l border-gray-50 dark:border-gray-800/50",
                today && "bg-violet-50/50 dark:bg-violet-950/20"
              )}>
                <div className="text-[10px] font-medium text-gray-400 uppercase">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center mx-auto text-sm font-semibold",
                  today ? "bg-violet-600 text-white" : "text-gray-700 dark:text-gray-300"
                )}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800">
          <div className="p-1.5 text-[9px] text-gray-400 text-right pr-2">all day</div>
          {weekDays.map(day => {
            const dateStr = toDateStr(day);
            const dayTasks = (tasksByDate[dateStr] || []).filter(t => !t.dueTime);
            const dayEvents = (eventsByDate[dateStr] || []).filter(e => e.isAllDay);
            return (
              <div key={dateStr + "-allday"} className="p-1 border-l border-gray-50 dark:border-gray-800/50 min-h-[28px] space-y-0.5">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 truncate">
                    {ev.subject}
                  </div>
                ))}
                {dayTasks.slice(0, 2).map(t => (
                  <div key={t.id} className="flex items-center gap-1 text-[10px] px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-800/50 truncate">
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[t.priority] || PRIORITY_DOT[4])} />
                    <span className={cn("truncate", t.completed && "line-through text-gray-400")}>{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > 2 && <div className="text-[9px] text-gray-400 pl-1">+{dayTasks.length - 2}</div>}
              </div>
            );
          })}
        </div>

        {/* Time slots */}
        <div className="overflow-y-auto max-h-[500px]">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-50 dark:border-gray-800/30">
              <div className="p-1.5 text-[10px] text-gray-400 text-right pr-2 leading-[44px]">
                {hour % 12 === 0 ? 12 : hour % 12}{hour >= 12 ? "p" : "a"}
              </div>
              {weekDays.map(day => {
                const dateStr = toDateStr(day);
                const hourEvents = (eventsByDate[dateStr] || []).filter(e => {
                  if (e.isAllDay) return false;
                  const h = new Date(e.startDateTime).getHours();
                  return h === hour;
                });
                const hourTasks = (tasksByDate[dateStr] || []).filter(t => {
                  if (!t.dueTime) return false;
                  const h = parseInt(t.dueTime.split(":")[0], 10);
                  return h === hour;
                });
                const isSelected = selectedSlot?.dateStr === dateStr && selectedSlot?.hour === hour;
                return (
                  <div
                    key={dateStr + "-" + hour}
                    onClick={() => setSelectedSlot(isSelected ? null : { dateStr, hour })}
                    className={cn(
                      "h-11 border-l border-gray-50 dark:border-gray-800/30 p-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors",
                      isSelected && "bg-violet-50 dark:bg-violet-950/30 ring-1 ring-inset ring-violet-300"
                    )}
                  >
                    {hourEvents.map(ev => (
                      <div key={ev.id} className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 truncate mb-0.5">
                        {formatTime(ev.startDateTime)} {ev.subject}
                      </div>
                    ))}
                    {hourTasks.map(t => (
                      <div key={t.id} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 truncate mb-0.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[t.priority] || PRIORITY_DOT[4])} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected slot task list */}
      {selectedSlot && (() => {
        const dayTasks = tasksByDate[selectedSlot.dateStr] || [];
        const slotDate = new Date(selectedSlot.dateStr + "T00:00:00");
        return (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {slotDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                <span className="ml-2 text-xs text-gray-400">{dayTasks.filter(t => !t.completed).length} tasks</span>
              </h3>
              <button onClick={() => setSelectedSlot(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {dayTasks.length === 0 && (
                <div className="py-6 text-center text-sm text-gray-400">No tasks on this day</div>
              )}
              {dayTasks.map(task => (
                <TaskItem key={task.id} task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-50 dark:border-gray-800/50">
              <InlineAddTask defaultDate={selectedSlot.dateStr} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
