"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Target, FileText, AlertTriangle, CheckCircle2, Mail, Loader2 } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CaptureType = "task" | "note" | "risk" | "decision" | "followup";

const TYPE_CONFIG: Record<CaptureType, { icon: typeof Target; label: string; emoji: string; color: string }> = {
  task: { icon: Target, label: "Task", emoji: "🎯", color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" },
  note: { icon: FileText, label: "Note", emoji: "📝", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  risk: { icon: AlertTriangle, label: "Risk", emoji: "⚠️", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  decision: { icon: CheckCircle2, label: "Decision", emoji: "✅", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  followup: { icon: Mail, label: "Follow-up", emoji: "📧", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
};

const PLACEHOLDERS = ["Add a task...", "Note a decision...", "Log a risk...", "Follow up on..."];

export function QuickCaptureModal({ onClose, prefillText }: { onClose: () => void; prefillText?: string }) {
  const { projects, addTask, addRisk, addDecisionLog } = useTaskStore();
  const [text, setText] = useState(prefillText || "");
  const [captureType, setCaptureType] = useState<CaptureType>("task");
  const [isClassifying, setIsClassifying] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Task-specific fields
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState(projects.find(p => p.isInbox)?.id ?? "");
  // Risk-specific
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  // Decision-specific
  const [rationale, setRationale] = useState("");
  // Follow-up specific
  const [contactName, setContactName] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  // Cycle placeholders
  useEffect(() => {
    const iv = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(iv);
  }, []);

  // Auto-focus
  useEffect(() => { inputRef.current?.focus(); }, []);

  // AI Classification (debounced)
  const classify = useCallback(async (value: string) => {
    if (value.length < 3) return;
    setIsClassifying(true);
    try {
      const res = await apiFetch("/api/ai/classify-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setCaptureType(data.type);
        setConfidence(data.confidence);
        if (data.suggestedFields?.severity) setSeverity(data.suggestedFields.severity);
        if (data.suggestedFields?.dueDate) setDueDate(data.suggestedFields.dueDate);
      }
    } catch { /* silent */ }
    finally { setIsClassifying(false); }
  }, []);

  const handleTextChange = (value: string) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => classify(value), 400);
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      switch (captureType) {
        case "task":
        case "followup": {
          const taskData: Record<string, unknown> = {
            title: captureType === "followup" ? `Follow up: ${text}` : text,
            priority: 4,
            projectId: projectId || undefined,
            dueDate: (captureType === "followup" ? followUpDate : dueDate)
              ? new Date(captureType === "followup" ? followUpDate : dueDate).toISOString()
              : null,
          };
          const res = await apiFetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskData),
          });
          if (res.ok) {
            const task = await res.json();
            addTask(task);
            toast.success(captureType === "followup" ? "Follow-up created!" : "Task created!");
          }
          break;
        }
        case "risk": {
          const firstProject = projects.find(p => !p.isInbox);
          if (!firstProject) {
            toast.error("Create a project first to log risks");
            setIsSaving(false);
            return;
          }
          const riskRes = await apiFetch("/api/risks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: text,
              projectId: firstProject.id,
              probability: severity === "high" ? 4 : severity === "medium" ? 3 : 2,
              impact: severity === "high" ? 4 : severity === "medium" ? 3 : 2,
            }),
          });
          if (riskRes.ok) {
            const risk = await riskRes.json();
            addRisk(risk);
            toast.success("Risk logged!");
          }
          break;
        }
        case "decision": {
          const firstProj = projects.find(p => !p.isInbox);
          if (!firstProj) {
            toast.error("Create a project first to log decisions");
            setIsSaving(false);
            return;
          }
          const decRes = await apiFetch("/api/decisions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: text,
              decision: text,
              context: rationale || null,
              projectId: firstProj.id,
            }),
          });
          if (decRes.ok) {
            const dec = await decRes.json();
            addDecisionLog(dec);
            toast.success("Decision logged!");
          }
          break;
        }
        case "note": {
          await apiFetch("/api/captured-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, type: "note" }),
          });
          toast.success("Note captured!");
          break;
        }
      }
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !e.shiftKey && text.trim()) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const typeConfig = TYPE_CONFIG[captureType];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[600px] mx-4 border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">Quick Capture</span>
            <span className="text-xs text-gray-400">⌘K</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main input */}
        <div className="px-5 py-4">
          <input
            ref={inputRef}
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIdx]}
            className="w-full text-lg bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Classification pills */}
        {text.length > 0 && (
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {isClassifying && <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />}
            {(Object.keys(TYPE_CONFIG) as CaptureType[]).map(t => {
              const cfg = TYPE_CONFIG[t];
              const isActive = captureType === t;
              return (
                <button
                  key={t}
                  onClick={() => setCaptureType(t)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                    isActive ? cfg.color + " ring-2 ring-offset-1 ring-violet-500/30" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {cfg.emoji} {cfg.label}
                  {isActive && confidence > 0 && (
                    <span className="text-[10px] opacity-60">{Math.round(confidence * 100)}%</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Secondary fields */}
        {text.length > 0 && (
          <div className="px-5 pb-4 space-y-3">
            {captureType === "task" && (
              <div className="flex gap-3 flex-wrap">
                <input
                  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <select
                  value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {captureType === "risk" && (
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                      severity === s
                        ? s === "high" ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300"
                          : s === "medium" ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900 dark:border-amber-700 dark:text-amber-300"
                          : "bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-300"
                        : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <select
                  value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 ml-auto"
                >
                  {projects.filter(p => !p.isInbox).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {captureType === "decision" && (
              <input
                value={rationale} onChange={e => setRationale(e.target.value)}
                placeholder="Rationale / context (optional)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400"
              />
            )}
            {captureType === "followup" && (
              <div className="flex gap-3 flex-wrap">
                <input
                  value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="Contact name"
                  className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400"
                />
                <input
                  type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
          <div className="text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">Esc</kbd> close
            <span className="mx-2">·</span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">↵</kbd> save
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !text.trim()}
              className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save {typeConfig.emoji}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
