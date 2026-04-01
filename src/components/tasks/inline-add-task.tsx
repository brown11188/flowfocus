"use client";
import { useState, useRef } from "react";
import { useTaskStore } from "@/store/task-store";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_CONFIG } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface InlineAddTaskProps {
  defaultDate?: string;
  defaultProjectId?: string;
  onAdd?: (task: unknown) => void;
}

export function InlineAddTask({ defaultDate, defaultProjectId, onAdd }: InlineAddTaskProps) {
  const { addTask, projects } = useTaskStore();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<1|2|3|4>(4);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inboxId = projects.find(p => p.isInbox)?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          priority,
          // Parse date string as LOCAL midnight, not UTC midnight.
          // new Date("YYYY-MM-DD") is UTC 00:00, which shifts the day in UTC+ timezones.
          // Appending T12:00:00 (local noon) avoids any DST or timezone drift.
          dueDate: defaultDate ? (() => {
            const [y, m, d] = defaultDate.split("-").map(Number);
            return new Date(y, m - 1, d, 12, 0, 0).toISOString();
          })() : null,
          projectId: defaultProjectId || inboxId,
        }),
      });
      const task = await res.json();
      addTask(task);
      onAdd?.(task);
      setTitle("");
      setPriority(4);
      // Keep form open for quick consecutive entry
      // Focus back on input so user can type the next task immediately
      setTimeout(() => inputRef.current?.focus(), 0);
      toast.success("Task added!");
    } catch { toast.error("Failed to add task"); }
    finally { setIsLoading(false); }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors py-2 px-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 w-full"
      >
        <Plus className="w-4 h-4" />
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-violet-300 dark:border-violet-700 rounded-xl p-3 bg-white dark:bg-gray-900 shadow-sm">
      <input
        ref={inputRef}
        autoFocus value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Task name"
        className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none mb-2"
        onKeyDown={e => e.key === "Escape" && setIsOpen(false)}
      />
      <div className="flex items-center justify-between">
        <select
          value={priority} onChange={e => setPriority(Number(e.target.value) as 1|2|3|4)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:outline-none"
        >
          {[1,2,3,4].map(p => <option key={p} value={p}>P{p} – {PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
          <button type="submit" disabled={isLoading || !title.trim()} className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            Add task
          </button>
        </div>
      </div>
    </form>
  );
}
