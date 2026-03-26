"use client";
import { useState, useEffect, useCallback } from "react";
import { Sprint } from "@/types";
import { apiFetch } from "@/lib/api";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { Plus, Zap, Calendar, Trash2, Play, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/components/tasks/task-item";

export default function SprintsPage() {
  const { projects, tasks, updateTask } = useTaskStore();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "", projectId: "" });
  const [backlogTask, setBacklogTask] = useState("");
  const [movingToSprint, setMovingToSprint] = useState<string | null>(null);

  const nonInboxProjects = projects.filter(p => !p.isInbox);

  const load = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/sprints?projectId=' + selectedProject);
      const data = await res.json();
      setSprints(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load sprints'); }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const pid = form.projectId || selectedProject;
    if (!form.name.trim() || !form.startDate || !form.endDate || !pid) {
      toast.error('Name, start date, end date, and project required'); return;
    }
    try {
      const res = await apiFetch('/api/sprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, projectId: pid }) });
      const s = await res.json();
      setSprints(prev => [...prev, s]);
      setForm({ name: '', goal: '', startDate: '', endDate: '', projectId: '' });
      setShowForm(false);
      toast.success('Sprint created!');
    } catch { toast.error('Failed to create sprint'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch('/api/sprints/' + id, { method: 'DELETE' });
      setSprints(prev => prev.filter(s => s.id !== id));
      toast.success('Sprint deleted');
    } catch { toast.error('Failed to delete sprint'); }
  };

  const handleActivate = async (sprint: Sprint) => {
    try {
      const res = await apiFetch('/api/sprints/' + sprint.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !sprint.isActive }) });
      const updated = await res.json();
      setSprints(prev => prev.map(s => {
        if (s.id === sprint.id) return updated;
        if (sprint.isActive === false) return { ...s, isActive: false };
        return s;
      }));
    } catch { toast.error('Failed to update sprint'); }
  };

  const handleMoveTask = async (taskId: string, sprintId: string) => {
    updateTask(taskId, { sprintId });
    await apiFetch('/api/tasks/' + taskId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId }) });
    setMovingToSprint(null);
    toast.success('Task added to sprint');
  };

  const handleRemoveFromSprint = async (taskId: string) => {
    updateTask(taskId, { sprintId: null });
    await apiFetch('/api/tasks/' + taskId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sprintId: null }) });
    toast.success('Task removed from sprint');
  };

  const toggleExpand = (id: string) => {
    setExpandedSprints(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const getSprintStats = (sprint: Sprint) => {
    const sprintTasks = tasks.filter(t => t.sprintId === sprint.id && !t.isDeleted);
    const total = sprintTasks.length;
    const done = sprintTasks.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const now = new Date();
    const end = new Date(sprint.endDate);
    const isOverdue = end < now && !sprint.isCompleted;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    return { total, done, pct, isOverdue, daysLeft, sprintTasks };
  };

  // Backlog = project tasks with no sprint
  const backlogTasks = selectedProject
    ? tasks.filter(t => t.projectId === selectedProject && !t.sprintId && !t.isDeleted && !t.completed)
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sprints</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage Agile sprints and iteration planning</p>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Select project...</option>
              {nonInboxProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selectedProject && (
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> New Sprint
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">New Sprint</h3>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint name (e.g. Sprint 1)"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder-gray-400"
            />
            <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="Sprint goal (optional)"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder-gray-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start Date *</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date *</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">Create Sprint</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 rounded-xl text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {!selectedProject ? (
          <div className="text-center py-20"><Zap className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" /><p className="text-gray-500">Select a project to view sprints</p></div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Sprints */}
            {sprints.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No sprints yet. Create your first sprint!</div>
            ) : (
              <div className="space-y-4">
                {sprints.map(sprint => {
                  const { total, done, pct, isOverdue, daysLeft, sprintTasks } = getSprintStats(sprint);
                  const isExpanded = expandedSprints.has(sprint.id);
                  return (
                    <div key={sprint.id} className={cn("rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden", sprint.isActive ? "border-amber-300 dark:border-amber-700" : isOverdue ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-800")}>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button onClick={() => toggleExpand(sprint.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900 dark:text-white">{sprint.name}</span>
                                {sprint.isActive && <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Play className="w-2.5 h-2.5" />Active</span>}
                                {sprint.isCompleted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" />Done</span>}
                                {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>}
                              </div>
                              {sprint.goal && <p className="text-xs text-gray-500 mt-0.5 truncate">Goal: {sprint.goal}</p>}
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(sprint.startDate).toLocaleDateString()} – {new Date(sprint.endDate).toLocaleDateString()}</span>
                                {!isOverdue && !sprint.isCompleted && daysLeft > 0 && <span>{daysLeft}d left</span>}
                                <span>{done}/{total} tasks</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => handleActivate(sprint)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", sprint.isActive ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700")}>
                              {sprint.isActive ? 'Deactivate' : 'Set Active'}
                            </button>
                            <button onClick={() => handleDelete(sprint.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {/* Progress */}
                        <div className="mt-3">
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-500" : sprint.isActive ? "bg-amber-500" : "bg-violet-500")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                      {/* Expanded tasks */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-1">
                          {sprintTasks.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 text-center">No tasks in this sprint. Add tasks from the backlog below.</p>
                          ) : (
                            sprintTasks.map(t => (
                              <div key={t.id} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <TaskItem task={t} onComplete={(id, c) => { updateTask(id, { completed: c }); apiFetch('/api/tasks/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: c }) }); }} onEdit={(id, d) => { updateTask(id, d); apiFetch('/api/tasks/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); }} onDelete={(id) => { updateTask(id, { isDeleted: true }); apiFetch('/api/tasks/' + id, { method: 'DELETE' }); }} compact />
                                </div>
                                <button onClick={() => handleRemoveFromSprint(t.id)} className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0">Remove</button>
                              </div>
                            ))
                          )}
                          {/* Add from backlog */}
                          {backlogTasks.length > 0 && (
                            <div className="pt-2 flex items-center gap-2">
                              <select value={backlogTask} onChange={e => setBacklogTask(e.target.value)}
                                className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                              >
                                <option value="">Add from backlog...</option>
                                {backlogTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                              </select>
                              <button onClick={() => { if (backlogTask) { handleMoveTask(backlogTask, sprint.id); setBacklogTask(''); }}}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs transition-colors">Add</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Backlog section */}
            {backlogTasks.length > 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-5">
                <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Backlog ({backlogTasks.length} tasks)</h2>
                <div className="space-y-1">
                  {backlogTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <TaskItem task={t} onComplete={(id, c) => { updateTask(id, { completed: c }); apiFetch('/api/tasks/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: c }) }); }} onEdit={(id, d) => updateTask(id, d)} onDelete={(id) => { updateTask(id, { isDeleted: true }); apiFetch('/api/tasks/' + id, { method: 'DELETE' }); }} compact />
                      </div>
                      {sprints.length > 0 && (
                        <select onChange={e => e.target.value && handleMoveTask(t.id, e.target.value)} defaultValue=""
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:outline-none flex-shrink-0"
                        >
                          <option value="">→ Sprint</option>
                          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
