"use client";
import { useState, useMemo } from "react";
import { Task } from "@/types";
import { cn, isOverdue, isToday } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { TaskItem } from "@/components/tasks/task-item";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";

interface Props {
  tasks: Task[];
  onComplete: (id: string, v: boolean) => void;
  onEdit: (id: string, d: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function UpcomingCalendar({ tasks, onComplete, onEdit, onDelete }: Props) {
  const { timezone } = useTimezoneCtx();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday start
  const daysInMonth = lastDay.getDate();

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [year, month, startPad, daysInMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.filter(t => !t.isDeleted && t.dueDate && !t.parentId).forEach(t => {
      // Parse stored ISO string into local date to avoid UTC-offset day shift
      const d = new Date(t.dueDate!);
      const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // Build a LOCAL date string (YYYY-MM-DD) without UTC shift
  const toLocalDateStr = (d: Date) =>
    [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");

  const selectedDateStr = selectedDay ? toLocalDateStr(selectedDay) : null;
  const selectedTasks = selectedDateStr ? (tasksByDate[selectedDateStr] || []) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-4">
      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-gray-400 text-center">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={"pad-" + idx} className="h-20 border-r border-b border-gray-50 dark:border-gray-800/50" />;
            const dateStr = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
            const dayTasks = tasksByDate[dateStr] || [];
            const activeTasks = dayTasks.filter(t => !t.completed);
            const isSelected = selectedDateStr === dateStr;
            const isTodayDay = isToday(day, timezone);
            const hasOverdue = dayTasks.some(t => !t.completed && isOverdue(t.dueDate!, timezone));
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "h-20 p-1.5 border-r border-b border-gray-50 dark:border-gray-800/50 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  isSelected && "bg-violet-50 dark:bg-violet-950/50 ring-2 ring-inset ring-violet-400"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1",
                  isTodayDay ? "bg-violet-600 text-white" : "text-gray-700 dark:text-gray-300"
                )}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {activeTasks.slice(0, 2).map(t => (
                    <div
                      key={t.id}
                      className={cn(
                        "text-xs truncate px-1 rounded",
                        hasOverdue && isOverdue(t.dueDate!, timezone) ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" : "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
                      )}
                    >
                      {t.title}
                    </div>
                  ))}
                  {activeTasks.length > 2 && (
                    <div className="text-xs text-gray-400 px-1">+{activeTasks.length - 2} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day task panel */}
      {selectedDay && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
              {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {selectedTasks.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">{selectedTasks.filter(t => !t.completed).length} task{selectedTasks.length !== 1 ? "s" : ""}</span>
              )}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {selectedTasks.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No tasks on this day</p>
              </div>
            )}
            {selectedTasks.map(task => (
              <TaskItem key={task.id} task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-50 dark:border-gray-800/50">
            <InlineAddTask defaultDate={selectedDateStr!} />
          </div>
        </div>
      )}
    </div>
  );
}
