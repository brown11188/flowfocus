"use client";
import { useState, useEffect } from "react";
import { useTaskStore } from "@/store/task-store";
import { X, Flag, Calendar, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn, PRIORITY_CONFIG } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { parseNaturalLanguage } from "@/hooks/use-natural-language-parse";

const PRIORITY_PILL_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  2: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  3: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  4: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function QuickAddModal({ onClose, defaultProjectId }: { onClose: () => void; defaultProjectId?: string }) {
  const { projects, addTask } = useTaskStore();
  const [rawInput, setRawInput] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState<1|2|3|4>(4);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects.find(p => p.isInbox)?.id ?? "");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNLPills, setShowNLPills] = useState(false);

  // FEAT-12: Natural language parsing
  useEffect(() => {
    if (!rawInput.trim()) {
      setShowNLPills(false);
      return;
    }
    const parsed = parseNaturalLanguage(rawInput);
    if (parsed.dueDate || parsed.priority || parsed.recurrence) {
      setShowNLPills(true);
      setTitle(parsed.title);
      if (parsed.dueDate) setDueDate(parsed.dueDate.split("T")[0]);
      if (parsed.priority) setPriority(parsed.priority as 1|2|3|4);
      if (parsed.recurrence) setRecurrence(parsed.recurrence);
    } else {
      setShowNLPills(false);
      setTitle(rawInput);
    }
  }, [rawInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskTitle = title.trim() || rawInput.trim();
    if (!taskTitle) return;
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { title: taskTitle, dueDate: dueDate ? new Date(dueDate).toISOString() : null, priority, projectId };
      if (recurrence) body.recurrenceRule = recurrence;
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          <div>
            <input
              autoFocus value={rawInput} onChange={e => setRawInput(e.target.value)}
              placeholder='Try: "Send report to Sarah tomorrow P1" or type normally'
              className="w-full px-0 py-1 text-base border-b-2 border-gray-200 dark:border-gray-700 focus:border-violet-500 bg-transparent outline-none dark:text-white placeholder-gray-400 transition-colors"
            />
            {/* FEAT-12: NL parsed pills */}
            {showNLPills && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Sparkles className="w-3 h-3 text-violet-400" />
                {dueDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    <Calendar className="w-3 h-3" />{new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                {priority && priority < 4 && (
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", PRIORITY_PILL_COLORS[priority])}>
                    <Flag className="w-3 h-3" />P{priority}
                  </span>
                )}
                {recurrence && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <RefreshCw className="w-3 h-3" />{recurrence}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setShowNLPills(false); setTitle(rawInput); setRecurrence(null); setPriority(4); }}
                  className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                >
                  edit
                </button>
              </div>
            )}
          </div>
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
          {recurrence && (
            <div className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
              <RefreshCw className="w-3 h-3" />
              Recurring: {recurrence}
              <button type="button" onClick={() => setRecurrence(null)} className="text-gray-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isLoading || (!title.trim() && !rawInput.trim())} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-colors font-medium">
              {isLoading ? "Adding..." : "Add Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
