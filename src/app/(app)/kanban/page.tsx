"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import {
  Plus, LayoutGrid, Loader2, Trash2, Check, X, ChevronDown,
  Pencil, Hash, GripVertical,
} from "lucide-react";
import { cn, PRIORITY_CONFIG } from "@/lib/utils";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, horizontalListSortingStrategy,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────
interface KanbanColumn {
  id: string; name: string; color: string;
  sortOrder: number; isDefault: boolean; projectId: string;
}

// ─── Colour palette ─────────────────────────────────────────────────────────
const COLORS = [
  "#6366f1", "#f59e0b", "#8b5cf6", "#10b981",
  "#3b82f6", "#ef4444", "#ec4899", "#14b8a6",
  "#f97316", "#84cc16", "#0ea5e9", "#a78bfa",
];

// ─── Task Card ────────────────────────────────────────────────────────────
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={onClick}
      className={cn(
        "group/card bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-100",
        "dark:border-gray-700 cursor-pointer select-none transition-all",
        "hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700",
        isDragging && "opacity-0",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium leading-snug",
            task.completed ? "line-through text-gray-400" : "text-gray-800 dark:text-white",
          )}>
            {task.title}
          </p>
        </div>
        <span
          className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
            priority.color.replace("text-", "bg-"))}
          title={priority.label}
        />
      </div>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400
                           bg-gray-50 dark:bg-gray-900/60 px-1.5 py-0.5 rounded-md">
            {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.subtasks && task.subtasks.length > 0 && (
          <span className="text-xs text-gray-400">
            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} sub
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Colour Picker Popover ────────────────────────────────────────────────
function ColorPicker({
  current, onChange, onClose,
}: { current: string; onChange: (c: string) => void; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-gray-900 rounded-xl
                    shadow-xl border border-gray-100 dark:border-gray-800 p-2.5 w-40">
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose(); }}
            className="w-5 h-5 rounded-full transition-transform hover:scale-125 flex items-center justify-center"
            style={{ background: c }}
          >
            {current === c && <Check className="w-3 h-3 text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────
function KanbanColumnComp({
  column, tasks, onAddTask, onCardClick, onRename, onDelete, onColorChange,
}: {
  column: KanbanColumn; tasks: Task[];
  onAddTask: (colId: string) => void;
  onCardClick: (task: Task) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const commitRename = async () => {
    const trimmed = draft.trim();
    setEditingName(false);
    if (trimmed && trimmed !== column.name) await onRename(column.id, trimmed);
  };

  return (
    <div
      ref={setNodeRef} style={style}
      className={cn(
        "group/col flex-shrink-0 w-72 flex flex-col",
        isDragging && "opacity-40",
      )}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 mb-3 px-1 py-1 rounded-lg
                   hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-grab active:cursor-grabbing"
        {...attributes} {...listeners}
      >
        {/* Colour dot */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker((p) => !p); }}
            onPointerDown={(e) => e.stopPropagation()} // prevent drag on click
            className="w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-900 hover:scale-125 transition-transform"
            style={{ background: column.color }}
            title="Change colour"
          />
          {showColorPicker && (
            <ColorPicker
              current={column.color}
              onChange={(c) => onColorChange(column.id, c)}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        {/* Name */}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setDraft(column.name); setEditingName(false); }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 text-sm font-semibold bg-transparent border-b-2 border-violet-500
                       outline-none text-gray-800 dark:text-white min-w-0"
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-200 truncate"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setDraft(column.name); setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 20); }}
            title="Click to rename"
          >
            {column.name}
          </span>
        )}

        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded-full flex-shrink-0">
          {tasks.length}
        </span>

        {/* Menu button */}
        <div className="relative flex-shrink-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowMenu((p) => !p); }}
            className="p-1 text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 rounded
                       opacity-0 group-hover/col:opacity-100 transition-all"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <div
              className="absolute top-full right-0 mt-1 z-30 bg-white dark:bg-gray-900 rounded-xl
                         shadow-xl border border-gray-100 dark:border-gray-800 py-1 w-36"
            >
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setDraft(column.name);
                  setEditingName(true);
                  setTimeout(() => nameInputRef.current?.focus(), 20);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300
                           hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  setShowColorPicker(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300
                           hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: column.color }} />
                Colour
              </button>
              {!column.isDefault && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(column.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500
                             hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-2 flex flex-col gap-2 min-h-28"
        style={{ borderTop: `3px solid ${column.color}` }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-gray-300 dark:text-gray-600">Drop tasks here</p>
          </div>
        )}
        {/* Inline quick-add */}
        <button
          onClick={() => onAddTask(column.id)}
          className="mt-auto flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-400
                     hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30
                     rounded-xl transition-colors w-full"
        >
          <Plus className="w-3.5 h-3.5" /> Add task
        </button>
      </div>
    </div>
  );
}

// ─── Kanban Page ────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, tasks, updateTask } = useTaskStore();

  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get("projectId") || "",
  );
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeCol, setActiveCol] = useState<KanbanColumn | null>(null);
  const [addingToCol, setAddingToCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const newColInputRef = useRef<HTMLInputElement>(null);

  const nonInboxProjects = projects.filter((p) => !p.isInbox);

  const loadColumns = useCallback(
    async (pid: string) => {
      if (!pid) return;
      setLoading(true);
      try {
        const res = await apiFetch("/api/kanban?projectId=" + pid);
        const data = await res.json();
        setColumns(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load kanban columns");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedProjectId) loadColumns(selectedProjectId);
    else setColumns([]);
  }, [selectedProjectId, loadColumns]);

  // Assign unassigned tasks to first column
  useEffect(() => {
    if (columns.length === 0 || !selectedProjectId) return;
    const firstCol = columns[0];
    tasks
      .filter((t) => t.projectId === selectedProjectId && !t.isDeleted && !t.kanbanColumnId)
      .forEach((t) => {
        updateTask(t.id, { kanbanColumnId: firstCol.id });
        apiFetch("/api/tasks/" + t.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kanbanColumnId: firstCol.id }),
        });
      });
  }, [columns, selectedProjectId]); // eslint-disable-line

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const getTasksForColumn = (colId: string) =>
    tasks
      .filter(
        (t) => t.projectId === selectedProjectId && !t.isDeleted && t.kanbanColumnId === colId,
      )
      .sort((a, b) => a.priority - b.priority);

  const allColIds = columns.map((c) => c.id);

  const handleDragStart = (e: DragStartEvent) => {
    const col = columns.find((c) => c.id === e.active.id);
    if (col) { setActiveCol(col); return; }
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || activeCol) return;
    if (allColIds.includes(active.id as string)) return;
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
    if (allColIds.includes(active.id as string) && allColIds.includes(over.id as string)) {
      const oldIdx = allColIds.indexOf(active.id as string);
      const newIdx = allColIds.indexOf(over.id as string);
      const reordered = arrayMove(columns, oldIdx, newIdx).map((c, i) => ({ ...c, sortOrder: i }));
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

    // ── Task column move ──
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;
    let targetColId = columns.find((c) => c.id === over.id)?.id;
    if (!targetColId) {
      const ot = tasks.find((t) => t.id === over.id);
      if (ot) targetColId = ot.kanbanColumnId ?? undefined;
    }
    if (!targetColId || targetColId === dragged.kanbanColumnId) return;
    updateTask(dragged.id, { kanbanColumnId: targetColId });
    try {
      await apiFetch("/api/tasks/" + dragged.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kanbanColumnId: targetColId }),
      });
    } catch {
      toast.error("Failed to move task");
      updateTask(dragged.id, { kanbanColumnId: dragged.kanbanColumnId });
    }
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

  const handleDeleteColumn = async (colId: string) => {
    await apiFetch("/api/kanban/" + colId, { method: "DELETE" });
    setColumns((p) => p.filter((c) => c.id !== colId));
    toast.success("Column deleted");
  };

  const handleAddColumn = async () => {
    if (!newColName.trim() || !selectedProjectId) return;
    const color = COLORS[columns.length % COLORS.length];
    const res = await apiFetch("/api/kanban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId, name: newColName, color }),
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
      body: JSON.stringify({
        title: newTaskTitle,
        projectId: selectedProjectId,
        kanbanColumnId: colId,
      }),
    });
    const t = await res.json();
    updateTask(t.id, t);
    setAddingToCol(null);
    setNewTaskTitle("");
    toast.success("Task added");
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* ── Header bar ── */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800
                      bg-white dark:bg-gray-900 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40
                          flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedProject ? selectedProject.name : "Kanban Board"}
            </h1>
            <p className="text-xs text-gray-400">
              {selectedProject
                ? `${columns.length} column${columns.length !== 1 ? "s" : ""} · Drag columns to reorder`
                : "Select a project to view its board"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              router.push(
                e.target.value ? `?projectId=${e.target.value}` : "?",
                { scroll: false },
              );
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-sm dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Select project…</option>
            {nonInboxProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selectedProjectId && (
            <button
              onClick={() => {
                setShowNewCol(true);
                setTimeout(() => newColInputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700
                         text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Column
            </button>
          )}
        </div>
      </div>

      {/* ── Board area ── */}
      {!selectedProjectId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-8 h-8 text-violet-300 dark:text-violet-700" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">Pick a project to get started</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
              Select a project from the dropdown above to view and manage its Kanban board.
            </p>
            {nonInboxProjects.length === 0 && (
              <p className="text-xs text-gray-400 mt-3">
                No projects yet &mdash; create one from the sidebar first.
              </p>
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-3 sm:p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allColIds} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 h-full pb-4">
                {columns.map((col) => (
                  <KanbanColumnComp
                    key={col.id}
                    column={col}
                    tasks={getTasksForColumn(col.id)}
                    onAddTask={(cid) => { setAddingToCol(cid); setNewTaskTitle(""); }}
                    onCardClick={(task) => toast.info(task.title)}
                    onRename={handleRename}
                    onDelete={handleDeleteColumn}
                    onColorChange={handleColorChange}
                  />
                ))}

                {/* Add column */}
                {showNewCol ? (
                  <div className="flex-shrink-0 w-72">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 space-y-2
                                    border border-dashed border-violet-300 dark:border-violet-700">
                      <input
                        ref={newColInputRef}
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddColumn();
                          if (e.key === "Escape") { setShowNewCol(false); setNewColName(""); }
                        }}
                        placeholder="Column name…"
                        autoFocus
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
                                   bg-transparent text-sm dark:text-white
                                   focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddColumn}
                          className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-700
                                     text-white rounded-lg text-xs font-medium"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowNewCol(false); setNewColName(""); }}
                          className="px-3 py-1.5 text-gray-500 rounded-lg text-xs
                                     hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowNewCol(true);
                      setTimeout(() => newColInputRef.current?.focus(), 50);
                    }}
                    className="flex-shrink-0 w-72 h-14 rounded-2xl border-2 border-dashed
                               border-gray-200 dark:border-gray-700 text-gray-400
                               hover:border-violet-400 hover:text-violet-500
                               text-sm transition-colors flex items-center justify-center gap-1.5 self-start"
                  >
                    <Plus className="w-4 h-4" /> Add Column
                  </button>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-2xl
                                border border-violet-200 dark:border-violet-700 w-72 rotate-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {activeTask.title}
                  </p>
                </div>
              )}
              {activeCol && (
                <div
                  className="flex-shrink-0 w-72 rounded-2xl shadow-2xl border-2 border-violet-400
                              p-3 bg-white dark:bg-gray-900 opacity-90 rotate-1"
                  style={{ borderTop: `3px solid ${activeCol.color}` }}
                >
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {activeCol.name}
                  </p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* ── Add task modal ── */}
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
                Add task → {columns.find((c) => c.id === addingToCol)?.name}
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
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700
                           text-white rounded-xl text-sm font-medium"
              >
                Add Task
              </button>
              <button
                onClick={() => setAddingToCol(null)}
                className="px-4 py-2 text-gray-500 rounded-xl text-sm
                           hover:bg-gray-100 dark:hover:bg-gray-800"
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
