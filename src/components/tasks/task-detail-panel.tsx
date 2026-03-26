"use client";
import { useState, useEffect } from "react";
import { Task, TimeLog } from "@/types";
import { cn, PRIORITY_CONFIG } from "@/lib/utils";
import { X, Trash2, Plus, Check, Flag, Clock, RefreshCw, Link2, Unlink } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Props {
  task: Task;
  onClose: () => void;
  onEdit: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string, completed: boolean) => void;
}

const RECURRENCE_OPTIONS = [
  { value: "", label: "No recurrence" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom interval" },
];

export function TaskDetailPanel({ task, onClose, onEdit, onDelete, onComplete }: Props) {
  const { projects, tasks, addTask, updateTask } = useTaskStore();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split("T")[0] : "");
  const [priority, setPriority] = useState(task.priority);
  const [projectId, setProjectId] = useState(task.projectId || "");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Pillar 1: Recurrence
  const [recurrenceRule, setRecurrenceRule] = useState(task.recurrenceRule || "");
  const [recurrenceInterval, setRecurrenceInterval] = useState(task.recurrenceInterval || 1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task.recurrenceEndDate ? task.recurrenceEndDate.split("T")[0] : ""
  );

  // Pillar 2: Time estimation
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours?.toString() || "");

  // Pillar 1: Dependencies
  const [blockingTaskId, setBlockingTaskId] = useState("");
  const [blockedBy, setBlockedBy] = useState(task.blockedBy || []);
  const [blocking, setBlocking] = useState(task.blocking || []);

  // Pillar 2: Time logs
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(task.timeLogs || []);
  const [logMinutes, setLogMinutes] = useState("");
  const [logNote, setLogNote] = useState("");
  const [showTimeLog, setShowTimeLog] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"details" | "time" | "deps">("details");

  const totalLoggedMinutes = timeLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalLoggedHours = (totalLoggedMinutes / 60).toFixed(1);
  const estimatedHoursNum = parseFloat(estimatedHours) || 0;
  const loggedHoursNum = totalLoggedMinutes / 60;
  const effortPct = estimatedHoursNum > 0 ? Math.min(100, Math.round((loggedHoursNum / estimatedHoursNum) * 100)) : 0;

  const handleSave = () => {
    if (!title.trim()) return;
    onEdit(task.id, {
      title,
      notes,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
      projectId: projectId || null,
      recurrenceRule: recurrenceRule || null,
      recurrenceInterval: recurrenceRule ? recurrenceInterval : null,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
    });
    setIsDirty(false);
  };

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: subtaskTitle, parentId: task.id, projectId: task.projectId, depth: (task.depth ?? 0) + 1 }),
      });
      const newTask = await res.json();
      addTask(newTask);
      setSubtaskTitle("");
      toast.success("Subtask added");
    } catch { toast.error("Failed to add subtask"); }
  };

  const handleCompleteSubtask = async (subtaskId: string, completed: boolean) => {
    updateTask(subtaskId, { completed });
    await apiFetch("/api/tasks/" + subtaskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  };

  const handleAddDependency = async () => {
    if (!blockingTaskId.trim()) return;
    try {
      const res = await apiFetch("/api/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedTaskId: task.id, blockingTaskId }),
      });
      if (!res.ok) { const e = await res.json(); toast.error(e.error); return; }
      const dep = await res.json();
      setBlockedBy(prev => [...prev, dep]);
      setBlockingTaskId("");
      toast.success("Dependency added");
    } catch { toast.error("Failed to add dependency"); }
  };

  const handleRemoveDependency = async (blockingId: string) => {
    try {
      await apiFetch("/api/dependencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedTaskId: task.id, blockingTaskId: blockingId }),
      });
      setBlockedBy(prev => prev.filter(d => d.blockingTaskId !== blockingId));
      toast.success("Dependency removed");
    } catch { toast.error("Failed to remove dependency"); }
  };

  const handleLogTime = async () => {
    const mins = parseInt(logMinutes);
    if (!mins || mins <= 0) return;
    try {
      const res = await apiFetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, durationMinutes: mins, note: logNote || null }),
      });
      const log = await res.json();
      setTimeLogs(prev => [log, ...prev]);
      setLogMinutes("");
      setLogNote("");
      setShowTimeLog(false);
      toast.success("Time logged!");
    } catch { toast.error("Failed to log time"); }
  };

  const handleDeleteTimeLog = async (logId: string) => {
    try {
      await apiFetch("/api/timelogs/" + logId, { method: "DELETE" });
      setTimeLogs(prev => prev.filter(l => l.id !== logId));
      toast.success("Log removed");
    } catch { toast.error("Failed to remove log"); }
  };

  useEffect(() => { setIsDirty(true); }, [title, notes, dueDate, priority, projectId, recurrenceRule, recurrenceInterval, recurrenceEndDate, estimatedHours]);

  // Available tasks for dependency selection (not self, not already a blocker)
  const availableTasks = tasks.filter(t =>
    t.id !== task.id &&
    !t.isDeleted &&
    !t.completed &&
    !blockedBy.some(d => d.blockingTaskId === t.id)
  );

  const isBlocked = blockedBy.some(d => !d.blockingTask?.completed);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onComplete(task.id, !task.completed)}
              className={cn(
                "w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                task.completed ? "bg-violet-500 border-violet-500" : "border-gray-300 hover:border-violet-500"
              )}
            >
              {task.completed && <Check className="w-3 h-3 text-white" />}
            </button>
            {isBlocked && !task.completed && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                🔒 Blocked
              </span>
            )}
            {task.recurrenceRule && (
              <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950 px-2 py-0.5 rounded-full border border-violet-200 dark:border-violet-800">
                <RefreshCw className="w-3 h-3" /> Recurring
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onDelete(task.id); onClose(); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {(["details", "time", "deps"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              {tab === "details" && "Details"}
              {tab === "time" && `Time ${estimatedHours ? `(${totalLoggedHours}h/${estimatedHours}h)` : `(${totalLoggedHours}h)`}`}
              {tab === "deps" && `Dependencies ${blockedBy.length + blocking.length > 0 ? `(${blockedBy.length + blocking.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <>
              <textarea
                value={title} onChange={e => setTitle(e.target.value)}
                className="w-full text-lg font-semibold bg-transparent border-none outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400"
                placeholder="Task title"
                rows={2}
              />
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full text-sm bg-transparent border-none outline-none resize-none text-gray-600 dark:text-gray-400 placeholder-gray-400"
                placeholder="Add notes..."
                rows={3}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Due Date</label>
                  <input
                    type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Priority</label>
                  <select
                    value={priority} onChange={e => setPriority(Number(e.target.value) as 1|2|3|4)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {[1,2,3,4].map(p => (
                      <option key={p} value={p}>P{p} — {PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Project</label>
                <select
                  value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Recurrence */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Recurrence
                </label>
                <select
                  value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {recurrenceRule === "CUSTOM" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Every</span>
                    <input
                      type="number" min={1} value={recurrenceInterval}
                      onChange={e => setRecurrenceInterval(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                )}
                {recurrenceRule && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">End date (optional)</label>
                    <input
                      type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                )}
              </div>

              {/* Subtasks */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Subtasks</label>
                <div className="space-y-1 mb-2">
                  {task.subtasks?.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <button
                        onClick={() => handleCompleteSubtask(sub.id, !sub.completed)}
                        className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all flex items-center justify-center",
                          sub.completed ? "bg-violet-500 border-violet-500" : "border-gray-300 hover:border-violet-500"
                        )}
                      >
                        {sub.completed && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                      <span className={cn("text-sm flex-1", sub.completed && "line-through text-gray-400 dark:text-gray-600")}>{sub.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder-gray-400"
                  />
                  <button onClick={handleAddSubtask} className="p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── TIME TAB ── */}
          {activeTab === "time" && (
            <div className="space-y-4">
              {/* Estimated hours */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Estimated hours
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="0.5" min="0" value={estimatedHours}
                    onChange={e => { setEstimatedHours(e.target.value); setIsDirty(true); }}
                    placeholder="0.0"
                    className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-xs text-gray-400">hours estimated</span>
                </div>
              </div>

              {/* Effort progress bar */}
              {(estimatedHoursNum > 0 || totalLoggedMinutes > 0) && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Logged: <span className="font-semibold text-gray-800 dark:text-white">{totalLoggedHours}h</span></span>
                    {estimatedHoursNum > 0 && <span>Estimated: <span className="font-semibold text-gray-800 dark:text-white">{estimatedHours}h</span></span>}
                  </div>
                  {estimatedHoursNum > 0 && (
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", effortPct >= 100 ? "bg-red-500" : effortPct >= 80 ? "bg-amber-500" : "bg-violet-500")}
                        style={{ width: `${Math.min(effortPct, 100)}%` }}
                      />
                    </div>
                  )}
                  {estimatedHoursNum > 0 && (
                    <p className="text-xs text-gray-400">{effortPct}% of estimate used</p>
                  )}
                </div>
              )}

              {/* Log time */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Time Logs</label>
                  <button
                    onClick={() => setShowTimeLog(!showTimeLog)}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Log time
                  </button>
                </div>

                {showTimeLog && (
                  <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-3 mb-3 space-y-2 bg-violet-50 dark:bg-violet-950/30">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="1" value={logMinutes}
                        onChange={e => setLogMinutes(e.target.value)}
                        placeholder="Minutes"
                        className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <span className="text-xs text-gray-500">minutes</span>
                    </div>
                    <input
                      value={logNote} onChange={e => setLogNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleLogTime}
                        className="flex-1 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                      >Save log</button>
                      <button
                        onClick={() => setShowTimeLog(false)}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {timeLogs.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No time logged yet</p>
                  )}
                  {timeLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800 dark:text-white">{log.durationMinutes}m</span>
                        {log.note && <span className="text-gray-500 dark:text-gray-400 ml-1 text-xs">— {log.note}</span>}
                        <div className="text-xs text-gray-400">{new Date(log.loggedAt).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => handleDeleteTimeLog(log.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DEPENDENCIES TAB ── */}
          {activeTab === "deps" && (
            <div className="space-y-4">
              {/* Blocked by */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> This task is blocked by
                </label>
                {blockedBy.length === 0 ? (
                  <p className="text-xs text-gray-400">No blockers</p>
                ) : (
                  <div className="space-y-1.5">
                    {blockedBy.map(dep => (
                      <div key={dep.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
                        dep.blockingTask?.completed
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
                          : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950"
                      )}>
                        <span className={dep.blockingTask?.completed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
                          {dep.blockingTask?.completed ? "✅" : "🔒"}
                        </span>
                        <span className="flex-1 truncate text-gray-800 dark:text-white">{dep.blockingTask?.title ?? dep.blockingTaskId}</span>
                        <button
                          onClick={() => handleRemoveDependency(dep.blockingTaskId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add blocker */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Add blocker task</label>
                <div className="flex gap-2">
                  <select
                    value={blockingTaskId} onChange={e => setBlockingTaskId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">Select a task...</option>
                    {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <button
                    onClick={handleAddDependency}
                    disabled={!blockingTaskId}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Blocking other tasks */}
              {blocking.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                    This task is blocking
                  </label>
                  <div className="space-y-1.5">
                    {blocking.map(dep => (
                      <div key={dep.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        <Flag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{dep.blockedTask?.title ?? dep.blockedTaskId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        {isDirty && activeTab === "details" && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button onClick={handleSave} className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
              Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
