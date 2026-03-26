"use client";
import { useState } from "react";
import { useTaskStore } from "@/store/task-store";
import { X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const COLORS = ["#6366f1", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6", "#f59e0b"];

export function AddProjectModal({ onClose }: { onClose: () => void }) {
  const { addProject } = useTaskStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const project = await res.json();
      addProject(project);
      toast.success("Project created!");
      onClose();
    } catch { toast.error("Failed to create project"); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Project name"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
          />
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className={"w-7 h-7 rounded-full transition-all " + (color === c ? "ring-2 ring-offset-2 ring-gray-400" : "")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Cancel</button>
            <button type="submit" disabled={isLoading || !name.trim()} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
