"use client";
import { useMemo, useState, useEffect } from "react";
import { useTaskStore } from "@/store/task-store";
import { Task } from "@/types";
import { isToday, isOverdue, cn } from "@/lib/utils";
import { TaskItem } from "@/components/tasks/task-item";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, RotateCcw, AlertCircle, List, Clock, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { exportTasksToCSV } from "@/lib/export";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useTimezoneCtx } from "@/components/layout/timezone-provider";
import { getTodayStrInTz } from "@/lib/timezone";
import { MorningPlanningPanel } from "@/components/features/morning-planning-panel";
import { EODWrapupBanner } from "@/components/features/eod-wrapup-banner";
import { TimelineView } from "@/components/features/timeline-view";

export default function TodayPage() {
  const { tasks, updateTask, removeTask, setTasks } = useTaskStore();
  const [showCompleted, setShowCompleted] = useState(false);
  const { timezone } = useTimezoneCtx();
  const [viewMode, setViewMode] = useState<"list" | "timeline">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("today_view") as "list" | "timeline") || "list";
    return "list";
  });

  // Fallback to list on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleViewChange = (mode: "list" | "timeline") => {
    setViewMode(mode);
    localStorage.setItem("today_view", mode);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const todayStr = getTodayStrInTz(timezone);
  const todayTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && t.dueDate && isToday(t.dueDate, timezone) && !t.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.priority - b.priority),
    [tasks, timezone]
  );
  const overdueTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && t.dueDate && isOverdue(t.dueDate, timezone) && !t.completed && !t.parentId),
    [tasks, timezone]
  );
  const activeTasks = todayTasks.filter(t => !t.completed);
  const completedTasks = todayTasks.filter(t => t.completed);

  const handleComplete = async (id: string, completed: boolean) => {
    updateTask(id, { completed, completedAt: completed ? new Date().toISOString() : null });
    await apiFetch("/api/tasks/" + id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
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

  const handleRescheduleOverdue = async () => {
    const overdue = tasks.filter(t => !t.isDeleted && t.dueDate && isOverdue(t.dueDate, timezone) && !t.completed);
    const todayDate = new Date().toISOString();
    for (const t of overdue) {
      updateTask(t.id, { dueDate: todayDate });
      await apiFetch("/api/tasks/" + t.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: todayDate }),
      });
    }
    toast.success(overdue.length + " task(s) rescheduled to today");
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = activeTasks.findIndex(t => t.id === active.id);
    const newIdx = activeTasks.findIndex(t => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeTasks, oldIdx, newIdx);
    const updatedAll = tasks.map(t => {
      const idx = reordered.findIndex(r => r.id === t.id);
      return idx !== -1 ? { ...t, sortOrder: idx } : t;
    });
    setTasks(updatedAll);
    await Promise.all(reordered.map((t, idx) =>
      apiFetch("/api/tasks/" + t.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: idx }),
      })
    ));
  };

  const effectiveView = isMobile ? "list" : viewMode;

  return (
    <div className={cn("mx-auto p-4 sm:p-6", effectiveView === "timeline" ? "max-w-5xl" : "max-w-2xl")}>
      <div className="flex items-center gap-3 mb-5 sm:mb-6">
        <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Today</h1>
          <p className="text-sm text-gray-400 truncate">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone })}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          {!isMobile && (
            <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button
                onClick={() => handleViewChange("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  effectiveView === "list" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => handleViewChange("timeline")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  effectiveView === "timeline" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
                )}
              >
                <Clock className="w-3.5 h-3.5" /> Timeline
              </button>
            </div>
          )}
          <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
            <span className="font-semibold text-violet-600">{activeTasks.length}</span>
            <span className="hidden sm:inline ml-1">remaining</span>
          </div>
          {/* FEAT-09: Export */}
          <button
            onClick={() => exportTasksToCSV([...activeTasks, ...completedTasks], "today-tasks.csv")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
            title="Export as CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Morning planning panel */}
      <MorningPlanningPanel />

      {/* EOD wrap-up banner */}
      <EODWrapupBanner />

      {effectiveView === "timeline" ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4" style={{ minHeight: 600 }}>
          <TimelineView />
        </div>
      ) : (
        <>
          {/* Overdue banner */}
          {overdueTasks.length > 0 && (
            <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-200 dark:border-red-800">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">
                <span className="font-semibold">{overdueTasks.length} overdue</span> task{overdueTasks.length > 1 ? "s" : ""} from previous days
              </span>
              <button
                onClick={handleRescheduleOverdue}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reschedule all
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={activeTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {activeTasks.length === 0 && completedTasks.length === 0 && (
                    <div className="py-12 text-center">
                      <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-400">No tasks for today</p>
                      <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Add your first task below!</p>
                    </div>
                  )}
                  {activeTasks.map(task => (
                    <TaskItem key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} onDelete={handleDelete} draggable />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="px-3 py-2 border-t border-gray-50 dark:border-gray-800/50">
              <InlineAddTask defaultDate={todayStr} />
            </div>

            {completedTasks.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <ChevronDown className={"w-4 h-4 transition-transform " + (showCompleted ? "rotate-180" : "")} />
                  {completedTasks.length} completed
                </button>
                {showCompleted && (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {completedTasks.map(task => (
                      <TaskItem key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
