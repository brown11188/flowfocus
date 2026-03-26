"use client";
import { useState } from "react";
import { useTaskStore } from "@/store/task-store";
import { X, Flag } from "lucide-react";
import { toast } from "sonner";
import { cn, PRIORITY_CONFIG } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export function QuickAddModal({ onClose, defaultProjectId }: { onClose: () => void; defaultProjectId?: string }) {
  const { projects, addTask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState<1|2|3|4>(4);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects.find(p => p.isInbox)?.id ?? "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: dueDate ? new Date(dueDate).toISOString() : null, priority, projectId }),
      });
      const task = await res.json();
      addTask(task);
      toast.success("Task created!");
      onClose();
    } catch { toast.error("Failed to create task"); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Quick Add Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-0 py-1 text-base border-b-2 border-gray-200 dark:border-gray-700 focus:border-violet-500 dark:border-gray-700 bg-transparent outline-none dark:text-white placeholder-gray-400 transition-colors"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <select
              value={priority} onChange={e => setPriority(Number(e.target.value) as 1|2|3|4)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {[1,2,3,4].map(p => <option key={p} value={p}>P{p} – {PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}</option>)}
            </select>
            <select
              value={projectId} onChange={e => setProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading || !title.trim()} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-colors font-medium">
              {isLoading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
