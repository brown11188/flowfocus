"use client";
import { useMemo, useState } from "react";
import { useTaskStore } from "@/store/task-store";
import { Task } from "@/types";
import { isToday, isOverdue, cn } from "@/lib/utils";
import { TaskItem } from "@/components/tasks/task-item";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, RotateCcw, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

export default function TodayPage() {
  const { tasks, updateTask, removeTask, setTasks } = useTaskStore();
  const [showCompleted, setShowCompleted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && t.dueDate && isToday(t.dueDate) && !t.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.priority - b.priority),
    [tasks]
  );
  const overdueTasks = useMemo(() =>
    tasks.filter(t => !t.isDeleted && t.dueDate && isOverdue(t.dueDate) && !t.completed && !t.parentId),
    [tasks]
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
    const overdue = tasks.filter(t => !t.isDeleted && t.dueDate && isOverdue(t.dueDate) && !t.completed);
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

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-5 sm:mb-6">
        <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Today</h1>
          <p className="text-sm text-gray-400 truncate">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
          <span className="font-semibold text-violet-600">{activeTasks.length}</span>
          <span className="hidden sm:inline">remaining</span>
        </div>
      </div>

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
    </div>
  );
}
