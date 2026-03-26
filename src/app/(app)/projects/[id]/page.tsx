"use client";
import { use, useMemo, useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTaskStore } from "@/store/task-store";
import { Task } from "@/types";
import { TaskItem } from "@/components/tasks/task-item";
import { InlineAddTask } from "@/components/tasks/inline-add-task";
import { toast } from "sonner";
import { Hash, FolderOpen, Pencil, ChevronDown, LayoutGrid, Plus, Trash2, Check, X, Loader2 } from "lucide-react";
import { cn, PRIORITY_CONFIG } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
  closestCorners, rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, horizontalListSortingStrategy,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


// ─── Types ────────────────────────────────────────────────────────────────
interface KanbanColumn { id: string; name: string; color: string; sortOrder: number; isDefault: boolean; projectId: string; }

type ViewTab = "tasks" | "kanban";

// ─── Colour palette for columns ───────────────────────────────────────────
const COLUMN_COLORS = [
  "#6366f1", "#f59e0b", "#8b5cf6", "#10b981",
  "#3b82f6", "#ef4444", "#ec4899", "#14b8a6",
  "#f97316", "#84cc16",
];

// ─── Kanban Card ─────────────────────────────────────────────────────────
function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onClick}
      className={cn(
        "group bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-100",
        "dark:border-gray-700 cursor-pointer select-none transition-all",
        "hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700",
        isDragging && "opacity-0",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug flex-1">{task.title}</p>
        <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", priority.color.replace("text-", "bg-"))} />
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.dueDate && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.subtasks && task.subtasks.length > 0 && (
          <span className="text-xs text-gray-400">
            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Column header with inline rename ─────────────────────────────────────
function ColumnHeader({
  column, onRename, onDelete, onColorChange,
}: {
  column: KanbanColumn;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const [showPalette, setShowPalette] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== column.name) onRename(column.id, trimmed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      {/* Colour dot — opens palette */}
      <div className="relative">
        <button
          onClick={() => setShowPalette((p) => !p)}
          className="w-3 h-3 rounded-full flex-shrink-0 transition-transform hover:scale-125 ring-2 ring-white dark:ring-gray-900"
          style={{ background: column.color }}
          title="Change color"
        />
        {showPalette && (
          <div
            className="absolute top-5 left-0 z-30 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100
                       dark:border-gray-800 p-2 grid grid-cols-5 gap-1.5 w-36"
          >
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onColorChange(column.id, c); setShowPalette(false); }}
                className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                style={{ background: c }}
              >
                {column.color === c && <Check className="w-3 h-3 text-white mx-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Name — click to edit */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(column.name); setEditing(false); }
          }}
          autoFocus
          className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-violet-500 outline-none
                     text-gray-800 dark:text-white min-w-0"
        />
      ) : (
        <button
          onClick={() => { setDraft(column.name); setEditing(true); }}
          className="flex-1 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 truncate hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          title="Click to rename"
        >
          {column.name}
        </button>
      )}

      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
        {/* count injected by parent */}
      </span>

      {!column.isDefault && (
        <button
          onClick={() => onDelete(column.id)}
          className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover/col:opacity-100"
          title="Delete column"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Draggable Column ─────────────────────────────────────────────────────
function KanbanColComp({
  column, tasks, onAddTask, onCardClick, onRename, onDelete, onColorChange,
}: {
  column: KanbanColumn;
  tasks: Task[];
  onAddTask: (colId: string) => void;
  onCardClick: (task: Task) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef} style={style}
      className={cn(
        "group/col flex-shrink-0 w-72 flex flex-col",
        isDragging && "opacity-40",
      )}
    >
      {/* Column drag handle — only on the top bar */}
      <div
        className="flex items-center gap-2 mb-3 px-1 cursor-grab active:cursor-grabbing"
        {...attributes} {...listeners}
      >
        <button
          onClick={(e) => { e.stopPropagation(); }}
          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900 cursor-pointer hover:scale-125 transition-transform"
          style={{ background: column.color }}
          title="Drag to reorder"
        />
        <span className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate select-none">
          {column.name}
        </span>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
          {tasks.length}
        </span>
      </div>

      {/* Column body — tasks droppable */}
      <div
        className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-2 min-h-28 flex flex-col gap-2"
        style={{ borderTop: `3px solid ${column.color}` }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <KanbanCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-300 dark:text-gray-600">No tasks</p>
          </div>
        )}
        {/* Bottom quick-add */}
        <button
          onClick={() => onAddTask(column.id)}
          className="mt-auto flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400 hover:text-violet-600
                     hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-xl transition-colors w-full"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>

      {/* Column actions below body */}
      <div className="flex items-center gap-1 mt-1.5 px-1">
        <button
          onClick={() => {
            const name = window.prompt("Rename column:", column.name);
            if (name?.trim()) onRename(column.id, name.trim());
          }}
          className="text-xs text-gray-400 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50
                     dark:hover:bg-violet-950/30 transition-colors"
        >
          Rename
        </button>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // toggle a tiny data-attr to show colour picker below
              const el = e.currentTarget.parentElement!;
              el.dataset.open = el.dataset.open === "1" ? "0" : "1";
              el.querySelector("div")?.classList.toggle("hidden");
            }}
            className="text-xs text-gray-400 hover:text-violet-600 px-2 py-1 rounded-lg
                       hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
          >
            Colour
          </button>
          <div className="hidden absolute bottom-full left-0 mb-1 z-30 bg-white dark:bg-gray-900 rounded-xl
                          shadow-xl border border-gray-100 dark:border-gray-800 p-2 grid grid-cols-5 gap-1.5 w-36">
            {COLUMN_COLORS.map((c) => (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  onColorChange(column.id, c);
                  const el = (e.currentTarget as HTMLElement).closest("div")!;
                  el.classList.add("hidden");
                  const parent = el.parentElement!;
                  parent.dataset.open = "0";
                }}
                className="w-5 h-5 rounded-full transition-transform hover:scale-125 flex items-center justify-center"
                style={{ background: c }}
              >
                {column.color === c && <Check className="w-3 h-3 text-white" />}
              </button>
            ))}
          </div>
        </div>
        {!column.isDefault && (
          <button
            onClick={() => onDelete(column.id)}
            className="ml-auto text-xs text-gray-300 hover:text-red-500 px-2 py-1 rounded-lg
                       hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Embedded Kanban View ─────────────────────────────────────────────────
function KanbanView({ projectId }: { projectId: string }) {
  const { tasks, updateTask } = useTaskStore();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCol, setActiveCol] = useState<KanbanColumn | null>(null);
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const newColInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/api/kanban?projectId=" + projectId)
      .then((r) => r.json())
      .then((d) => setColumns(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Failed to load kanban"))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Assign unassigned tasks to first column
  useEffect(() => {
    if (columns.length === 0) return;
    const first = columns[0];
    tasks
      .filter((t) => t.projectId === projectId && !t.isDeleted && !t.kanbanColumnId)
      .forEach((t) => {
        updateTask(t.id, { kanbanColumnId: first.id });
        apiFetch("/api/tasks/" + t.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kanbanColumnId: first.id }),
        });
      });
  }, [columns, projectId]); // eslint-disable-line

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const getTasksForCol = (colId: string) =>
    tasks
      .filter((t) => t.projectId === projectId && !t.isDeleted && t.kanbanColumnId === colId)
      .sort((a, b) => a.priority - b.priority);

  const allColIds = columns.map((c) => c.id);

  const handleDragStart = (e: DragStartEvent) => {
    const isCol = columns.find((c) => c.id === e.active.id);
    if (isCol) { setActiveCol(isCol); return; }
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || activeCol) return; // column drag handled in dragEnd
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;
    let targetColId = columns.find((c) => c.id === over.id)?.id;
    if (!targetColId) {
      const ot = tasks.find((t) => t.id === over.id);
      if (ot) targetColId = ot.kanbanColumnId ?? undefined;
    }
    if (targetColId && targetColId !== dragged.kanbanColumnId) {
      updateTask(dragged.id, { kanbanColumnId: targetColId });
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    setActiveCol(null);
    if (!over || active.id === over.id) return;

    // ── Column reorder ──
    if (allColIds.includes(active.id as string)) {
      const oldIndex = allColIds.indexOf(active.id as string);
      const newIndex = allColIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({
        ...c,
        sortOrder: i,
      }));
      setColumns(reordered);
      await Promise.all(
        reordered.map((c) =>
          apiFetch("/api/kanban/" + c.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: c.sortOrder }),
          }),
        ),
      );
      return;
    }

    // ── Task move across columns ──
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;
    let targetColId = columns.find((c) => c.id === over.id)?.id;
    if (!targetColId) {
      const ot = tasks.find((t) => t.id === over.id);
      if (ot) targetColId = ot.kanbanColumnId ?? undefined;
    }
    if (!targetColId || targetColId === dragged.kanbanColumnId) return;
    updateTask(dragged.id, { kanbanColumnId: targetColId });
    await apiFetch("/api/tasks/" + dragged.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kanbanColumnId: targetColId }),
    });
  };

  const handleRename = async (colId: string, name: string) => {
    setColumns((p) => p.map((c) => (c.id === colId ? { ...c, name } : c)));
    await apiFetch("/api/kanban/" + colId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    toast.success("Column renamed");
  };

  const handleColorChange = async (colId: string, color: string) => {
    setColumns((p) => p.map((c) => (c.id === colId ? { ...c, color } : c)));
    await apiFetch("/api/kanban/" + colId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  };

  const handleDeleteCol = async (colId: string) => {
    await apiFetch("/api/kanban/" + colId, { method: "DELETE" });
    setColumns((p) => p.filter((c) => c.id !== colId));
    toast.success("Column deleted");
  };

  const handleAddCol = async () => {
    if (!newColName.trim()) return;
    const color = COLUMN_COLORS[columns.length % COLUMN_COLORS.length];
    const res = await apiFetch("/api/kanban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: newColName, color }),
    });
    const col = await res.json();
    setColumns((p) => [...p, col]);
    setNewColName("");
    setShowNewCol(false);
    toast.success("Column added");
  };

  const handleAddTask = async (colId: string) => {
    if (!newTaskTitle.trim()) return;
    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTaskTitle, projectId, kanbanColumnId: colId }),
    });
    const t = await res.json();
    updateTask(t.id, t);
    setAddingToCol(null);
    setNewTaskTitle("");
    toast.success("Task added");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
      </div>
    );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allColIds} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-4 pb-4 overflow-x-auto">
            {columns.map((col) => (
              <KanbanColComp
                key={col.id}
                column={col}
                tasks={getTasksForCol(col.id)}
                onAddTask={(cid) => { setAddingToCol(cid); setNewTaskTitle(""); }}
                onCardClick={(task) => toast.info(task.title)} // TODO: open detail panel
                onRename={handleRename}
                onDelete={handleDeleteCol}
                onColorChange={handleColorChange}
              />
            ))}

            {/* Add Column button */}
            {showNewCol ? (
              <div className="flex-shrink-0 w-72">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-3 space-y-2">
                  <input
                    ref={newColInputRef}
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCol();
                      if (e.key === "Escape") { setShowNewCol(false); setNewColName(""); }
                    }}
                    placeholder="Column name…"
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                               bg-white dark:bg-gray-900 text-sm dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCol}
                      className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowNewCol(false); setNewColName(""); }}
                      className="px-3 py-1.5 text-gray-500 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowNewCol(true); setTimeout(() => newColInputRef.current?.focus(), 50); }}
                className="flex-shrink-0 w-72 h-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700
                           text-gray-400 hover:border-violet-400 hover:text-violet-500 text-sm transition-colors
                           flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Column
              </button>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTask && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-2xl border border-violet-200 dark:border-violet-700 w-72 rotate-2">
              <p className="text-sm font-medium text-gray-800 dark:text-white">{activeTask.title}</p>
            </div>
          )}
          {activeCol && (
            <div
              className="flex-shrink-0 w-72 rounded-2xl shadow-2xl border-2 border-violet-400 p-3 bg-white dark:bg-gray-900 opacity-90 rotate-1"
              style={{ borderTop: `3px solid ${activeCol.color}` }}
            >
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{activeCol.name}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add-task modal */}
      {addingToCol && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setAddingToCol(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Add Task → {columns.find((c) => c.id === addingToCol)?.name}
              </h3>
              <button onClick={() => setAddingToCol(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask(addingToCol);
                if (e.key === "Escape") setAddingToCol(null);
              }}
              placeholder="Task title…"
              autoFocus
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-transparent text-sm dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAddTask(addingToCol)}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium"
              >
                Add Task
              </button>
              <button
                onClick={() => setAddingToCol(null)}
                className="px-4 py-2 text-gray-500 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Project Page ──────────────────────────────────────────────────────────
function ProjectPageInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, tasks, updateTask, removeTask, updateProject } = useTaskStore();
  const [showCompleted, setShowCompleted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const currentView = (searchParams.get("view") as ViewTab) ?? "tasks";

  const project = projects.find((p) => p.id === id);
  const projectTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.projectId === id && !t.isDeleted && !t.parentId)
        .sort((a, b) => a.priority - b.priority),
    [tasks, id],
  );
  const activeTasks = projectTasks.filter((t) => !t.completed);
  const completedTasks = projectTasks.filter((t) => t.completed);

  const handleComplete = async (taskId: string, completed: boolean) => {
    updateTask(taskId, { completed, completedAt: completed ? new Date().toISOString() : null });
    await apiFetch("/api/tasks/" + taskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  };

  const handleEdit = async (taskId: string, data: Partial<Task>) => {
    updateTask(taskId, data);
    await apiFetch("/api/tasks/" + taskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  };

  const handleDelete = async (taskId: string) => {
    removeTask(taskId);
    await apiFetch("/api/tasks/" + taskId, { method: "DELETE" });
    toast.success("Task deleted");
  };

  const setView = (v: ViewTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    router.push(url.pathname + url.search, { scroll: false });
  };

  if (!project)
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-gray-400">Project not found</p>
      </div>
    );

  const tabs: { id: ViewTab; label: string; icon: React.ElementType }[] = [
    { id: "tasks", label: "Tasks", icon: Hash },
    ...(project.isInbox
      ? []
      : [{ id: "kanban" as ViewTab, label: "Kanban", icon: LayoutGrid }]),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
          {project.isInbox ? (
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" style={{ color: project.color }} />
          ) : (
            <Hash className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" style={{ color: project.color }} />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{project.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTasks.length} active · {completedTasks.length} completed
            </p>
          </div>
          {!project.isInbox && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-800">
            {tabs.map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                onClick={() => setView(tabId)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all",
                  currentView === tabId
                    ? "border-violet-500 text-violet-600 dark:text-violet-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tasks Tab ── */}
        {currentView === "tasks" && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {activeTasks.length === 0 && (
                <div className="py-12 text-center">
                  <Hash className="w-10 h-10 mx-auto mb-3" style={{ color: project.color + "40" }} />
                  <p className="text-sm text-gray-400">No active tasks in {project.name}</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Add your first task below!</p>
                </div>
              )}
              {activeTasks.map((task) => (
                <TaskItem key={task.id} task={task} onComplete={handleComplete} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-50 dark:border-gray-800/50">
              <InlineAddTask defaultProjectId={id} />
            </div>
            {completedTasks.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <ChevronDown
                    className={cn("w-4 h-4 transition-transform", showCompleted && "rotate-180")}
                  />
                  {completedTasks.length} completed
                </button>
                {showCompleted &&
                  completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── Kanban Tab ── */}
        {currentView === "kanban" && <KanbanView projectId={id} />}
      </div>

      {/* Edit project name modal */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-96 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Edit Project</h2>
            <input
              defaultValue={project.name}
              id="edit-project-name"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const input = document.getElementById("edit-project-name") as HTMLInputElement;
                  const name = input.value.trim();
                  if (!name) return;
                  updateProject(id, { name });
                  await apiFetch("/api/projects/" + id, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  });
                  setIsEditing(false);
                  toast.success("Project updated");
                }}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-500 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      }
    >
      <ProjectPageInner id={id} />
    </Suspense>
  );
}
