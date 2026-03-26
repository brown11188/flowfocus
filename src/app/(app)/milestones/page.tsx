"use client";
import { useState, useEffect, useCallback } from "react";
import { Milestone } from "@/types";
import { apiFetch } from "@/lib/api";
import { useTaskStore } from "@/store/task-store";
import { toast } from "sonner";
import { Plus, Target, Calendar, Trash2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MilestonesPage() {
  const { projects } = useTaskStore();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", targetDate: "", projectId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const url = selectedProject ? `/api/milestones?projectId=${selectedProject}` : "/api/milestones";
    try {
      const res = await apiFetch(url);
      const data = await res.json();
      setMilestones(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load milestones"); }
    finally { setLoading(false); }
  }, [selectedProject]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.targetDate || !form.projectId) {
      toast.error("Name, target date, and project are required"); return;
    }
    try {
      const res = await apiFetch("/api/milestones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const m = await res.json();
      setMilestones((prev) => [...prev, m]);
      setForm({ name: "", description: "", targetDate: "", projectId: "" });
      setShowForm(false);
      toast.success("Milestone created!");
    } catch { toast.error("Failed to create milestone"); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/milestones/${id}`, { method: "DELETE" });
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      toast.success("Milestone deleted");
    } catch { toast.error("Failed to delete milestone"); }
  };

  const getStatus = (m: Milestone) => {
    const total = m.tasks?.length ?? 0;
    const done = m.tasks?.filter((mt) => mt.task?.completed).length ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const now = new Date(); const target = new Date(m.targetDate);
    const isOverdue = target < now && pct < 100;
    const daysLeft = Math.ceil((target.getTime() - now.getTime()) / 86400000);
    return { total, done, pct, isOverdue, daysLeft };
  };

  const nonInboxProjects = projects.filter((p) => !p.isInbox);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Milestones</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track project checkpoints and deadlines</p>
            </div>
          </div>
          <div className="sm:flex-shrink-0">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> New Milestone
          </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedProject("")} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", !selectedProject ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300")}>All projects</button>
          {nonInboxProjects.map((p) => (
            <button key={p.id} onClick={() => setSelectedProject(p.id)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5", selectedProject === p.id ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300")}>
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">New Milestone</h3>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Milestone name *" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder-gray-400" />
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white placeholder-gray-400 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Target Date *</label>
                <input type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Project *</label>
                <select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white">
                  <option value="">Select project...</option>
                  {nonInboxProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">Create Milestone</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 rounded-xl text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-20">
            <Target className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No milestones yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((m) => {
              const { total, done, pct, isOverdue, daysLeft } = getStatus(m);
              const proj = projects.find((p) => p.id === m.projectId);
              return (
                <div key={m.id} className={cn("rounded-2xl border p-5 bg-white dark:bg-gray-900 shadow-sm", isOverdue ? "border-red-200 dark:border-red-800" : "border-gray-200 dark:border-gray-800")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", pct === 100 ? "bg-green-100 dark:bg-green-900/40" : isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-violet-100 dark:bg-violet-900/40")}>
                        <Target className={cn("w-4 h-4", pct === 100 ? "text-green-600" : isOverdue ? "text-red-600" : "text-violet-600")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{m.name}</h3>
                          {pct === 100 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Done</span>}
                          {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>}
                        </div>
                        {m.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{m.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {proj && <span className="text-xs flex items-center gap-1" style={{ color: proj.color }}><span className="w-2 h-2 rounded-full" style={{ background: proj.color }} />{proj.name}</span>}
                          <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.targetDate).toLocaleDateString()}{!isOverdue && pct < 100 && daysLeft > 0 && <span className="ml-1">({daysLeft}d left)</span>}</span>
                          {total > 0 && <span className="text-xs text-gray-400 flex items-center gap-1"><Link2 className="w-3 h-3" />{done}/{total} tasks</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{pct}% complete</span><span>{done}/{total} tasks done</span></div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-green-500" : isOverdue ? "bg-red-500" : "bg-violet-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}