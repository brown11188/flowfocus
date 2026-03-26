"use client";
import { useMemo, useState } from "react";
import { useTaskStore } from "@/store/task-store";
import { Task } from "@/types";
import { addDays, formatDayLabel, cn, formatDate, isOverdue as checkOverdue, PRIORITY_CONFIG } from "@/lib/utils";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { UpcomingCalendar } from "@/components/calendar/upcoming-calendar";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { ClickUpBadge } from "@/components/clickup/clickup-badge";
import { toast } from "sonner";
import { Calendar, List, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Flag, GripVertical, Clock, Lock, RefreshCw, ChevronRight as ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  DndContext, DragEndEvent, PointerSensor,
  useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── helpers ────────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// ─── UpcomingTaskCard ────────────────────────────────────────────────────────
// A card-style task row designed specifically for the Upcoming columns.
// Has its own bg/border so it visually separates from the column background.
function UpcomingTaskCard({
  task, onComplete, onEdit, onDelete, dragHandleProps,
}: {
  task: Task;
  onComplete: (id: string, v: boolean) => void;
  onEdit: (id: string, d: Partial<Task>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const overdueDate = task.dueDate && !task.completed && checkOverdue(task.dueDate);
  const isBlocked = task.blockedBy?.some(d => !d.blockingTask?.completed);
  const isRecurring = !!task.recurrenceRule;

  // Priority accent colours (left border)
  const accentClass = {
    "text-red-500":    "border-l-red-400",
    "text-orange-500": "border-l-orange-400",
    "text-blue-500":   "border-l-blue-400",
    "text-gray-400":   "border-l-gray-200 dark:border-l-gray-700",
  }[priority.color] ?? "border-l-gray-200 dark:border-l-gray-700";

  return (
    <>
      <div
        className={cn(
          "group relative flex items-start gap-2.5 px-3 py-2.5 rounded-xl",
          "bg-white dark:bg-gray-800",
          "border border-gray-100 dark:border-gray-700/60",
          "border-l-[3px]", accentClass,
          "shadow-sm hover:shadow-md",
          "transition-all duration-150",
          task.completed && "opacity-50",
        )}
      >
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            {...(dragHandleProps as React.HTMLAttributes<HTMLButtonElement>)}
            className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 transition-opacity"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Checkbox */}
        <button
          onClick={() => onComplete(task.id, !task.completed)}
          className={cn(
            "mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
            task.completed
              ? "bg-violet-500 border-violet-500"
              : priority.color.replace("text-", "border-") + " hover:bg-violet-100 dark:hover:bg-violet-900",
          )}
        >
          {task.completed && (
            <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
              <path d="M3 8l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setShowDetail(true)}
            className={cn(
              "text-sm text-left w-full leading-snug",
              task.completed ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-100",
            )}
          >
            {task.title}
          </button>

          {/* Meta row */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.project && !task.project.isInbox && (
              <span
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium"
                style={{
                  color: task.project.color,
                  background: task.project.color + "18",
                }}
              >
                {task.project.name}
              </span>
            )}
            {overdueDate && (
              <span className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center gap-0.5">
                ⚠ {formatDate(task.dueDate!)}
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md">
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
              </span>
            )}
            {isBlocked && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Lock className="w-3 h-3" /> Blocked
              </span>
            )}
            {isRecurring && (
              <span className="text-xs text-violet-400"><RefreshCw className="w-3 h-3" /></span>
            )}
            {task.estimatedHours && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{task.estimatedHours}h
              </span>
            )}
            {task.clickupTaskId && (
              <ClickUpBadge url={task.clickupUrl} status={task.clickupStatus} />
            )}
          </div>
        </div>

        {/* Right: priority flag + detail arrow */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Flag className={cn("w-3.5 h-3.5", priority.color)} />
          <button onClick={() => setShowDetail(true)} className="text-gray-300 hover:text-gray-500 dark:hover:text-gray-300">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showDetail && (
        <TaskDetailPanel
          task={task}
          onClose={() => setShowDetail(false)}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
        />
      )}
    </>
  );
}

// ─── DraggableTask ──────────────────────────────────────────────────────────
function DraggableTask({
  task, onComplete, onEdit, onDelete,
}: {
  task: Task;
  onComplete: (id: string, v: boolean) => void;
  onEdit: (id: string, d: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40 scale-95")}>
      <UpcomingTaskCard
        task={task}
        onComplete={onComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ─── DayColumn ──────────────────────────────────────────────────────────────
function DayColumn({
  date, tasks, onComplete, onEdit, onDelete,
}: {
  date: Date;
  tasks: Task[];
  onComplete: (id: string, v: boolean) => void;
  onEdit: (id: string, d: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const dateStr = toLocalDateStr(date);
  const { setNodeRef, isOver } = useDroppable({ id: "day-" + dateStr });
  const [isExpanded, setIsExpanded] = useState(true);

  const label = formatDayLabel(date);
  const isToday = label === "Today";
  const isTomorrow = label === "Tomorrow";
  const activeTasks = tasks.filter(t => !t.completed);
  const doneTasks = tasks.filter(t => t.completed);
  const hasOverdue = activeTasks.some(t => checkOverdue(t.dueDate ?? ""));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl border transition-all duration-200 min-h-[120px]",
        isOver
          ? "border-violet-400 bg-violet-50/80 dark:bg-violet-950/40 shadow-lg"
          : isToday
          ? "border-violet-200 dark:border-violet-800/60 bg-gray-50 dark:bg-gray-900/80"
          : "border-gray-200/70 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-900/60",
      )}
    >
      {/* Column header */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left group"
      >
        {/* Date badge */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold",
          isToday
            ? "bg-violet-600 text-white"
            : isTomorrow
            ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
        )}>
          {date.getDate()}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <span className={cn(
            "text-sm font-semibold leading-tight",
            isToday ? "text-violet-600 dark:text-violet-400" : "text-gray-800 dark:text-gray-200",
          )}>
            {label}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Task count badge */}
        {activeTasks.length > 0 && (
          <span className={cn(
            "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
            hasOverdue
              ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
              : isToday
              ? "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
          )}>
            {activeTasks.length}
          </span>
        )}

        <ChevronDown className={cn(
          "flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200",
          !isExpanded && "-rotate-90",
        )} />
      </button>

      {/* Task list */}
      {isExpanded && (
        <div className="flex flex-col flex-1 px-2.5 pb-3 gap-2">
          <SortableContext items={activeTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {activeTasks.map(task => (
              <DraggableTask key={task.id} task={task}
                onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </SortableContext>

          {/* Completed tasks — slightly dimmed */}
          {doneTasks.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-0.5">
              {doneTasks.map(task => (
                <UpcomingTaskCard key={task.id} task={task}
                  onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}

          {/* Inline add */}
          <div className="pt-0.5">
            <InlineAddTask defaultDate={dateStr} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function UpcomingPage() {
  const { tasks, updateTask, removeTask } = useTaskStore();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [startOffset, setStartOffset] = useState(0); // which day-window we're viewing
  const WINDOW = 5; // always show exactly 5 days

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // The 5 days currently in view
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: WINDOW }, (_, i) => addDays(today, startOffset + i));
  }, [startOffset]);

  const canGoPrev = startOffset > 0;

  const tasksByDay = useMemo(() => {
    return days.map(d => ({
      date: d,
      tasks: tasks.filter(t => {
        if (!t.dueDate || t.isDeleted || t.parentId) return false;
        const dd = new Date(t.dueDate);
        dd.setHours(0, 0, 0, 0);
        return dd.getTime() === d.getTime();
      }).sort((a, b) => a.priority - b.priority),
    }));
  }, [tasks, days]);

  const handleComplete = async (id: string, completed: boolean) => {
    updateTask(id, { completed, completedAt: completed ? new Date().toISOString() : null });
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed, completedAt: completed ? new Date().toISOString() : null }),
    });
  };

  const handleEdit = async (id: string, data: Partial<Task>) => {
    updateTask(id, data);
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  const handleDelete = async (id: string) => {
    removeTask(id);
    await apiFetch("/api/tasks/" + id, { method: "DELETE" });
    toast.success("Task deleted");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("day-")) return;
    const targetDateStr = overId.replace("day-", "");
    const targetDate = parseLocalDate(targetDateStr);
    const taskId = String(active.id);
    updateTask(taskId, { dueDate: targetDate.toISOString() });
    try {
      await apiFetch("/api/tasks/" + taskId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: targetDate.toISOString() }),
      });
      toast.success("Task rescheduled!");
    } catch {
      toast.error("Failed to reschedule");
    }
  };

  // Date range label for the header
  const rangeLabel = useMemo(() => {
    if (days.length === 0) return "";
    const first = days[0];
    const last = days[days.length - 1];
    const fmtOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${first.toLocaleDateString("en-US", fmtOpts)} – ${last.toLocaleDateString("en-US", fmtOpts)}`;
  }, [days]);

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950/20">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 gap-3 flex-wrap">
        {/* Left: title + date range */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Upcoming</h1>
            {view === "list" && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{rangeLabel}</p>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Prev / Next — only in list view */}
          {view === "list" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setStartOffset(o => Math.max(0, o - WINDOW))}
                disabled={!canGoPrev}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  canGoPrev
                    ? "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                    : "text-gray-200 dark:text-gray-700 cursor-not-allowed",
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStartOffset(0)}
                className={cn(
                  "px-3 h-8 rounded-lg text-xs font-medium transition-colors",
                  startOffset === 0
                    ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400",
                )}
              >
                Today
              </button>
              <button
                onClick={() => setStartOffset(o => o + WINDOW)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === "list"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700",
              )}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === "calendar"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700",
              )}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {view === "calendar" ? (
          <UpcomingCalendar
            tasks={tasks}
            onComplete={handleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {/* 5-column grid — always fills available width */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${WINDOW}, minmax(0, 1fr))` }}>
              {tasksByDay.map(({ date, tasks: dayTasks }) => (
                <DayColumn
                  key={toLocalDateStr(date)}
                  date={date}
                  tasks={dayTasks}
                  onComplete={handleComplete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
