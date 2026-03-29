"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Sparkles, FileText, ListOrdered, StickyNote, ArrowRight,
  GripVertical, Plus, Trash2, Copy, Loader2, CheckSquare, RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer?: { emailAddress: { address: string; name: string } } | null;
  bodyPreview?: string;
  webLink?: string;
}

interface MeetingPrepDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
}

interface AgendaItem {
  id: string;
  text: string;
}

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  checked: boolean;
}

interface DecisionItem {
  id: string;
  text: string;
}

type TabId = "brief" | "agenda" | "notes" | "followup";

export function MeetingPrepDrawer({ event, onClose }: MeetingPrepDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("brief");
  const meetingTime = new Date(event.start.dateTime);
  const isPast = meetingTime < new Date();

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "brief", label: "Brief", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "agenda", label: "Agenda", icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { id: "notes", label: "Notes", icon: <StickyNote className="w-3.5 h-3.5" /> },
    { id: "followup", label: "Follow-up", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {event.subject || "Meeting"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {meetingTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              {event.organizer?.emailAddress?.name ? ` · ${event.organizer.emailAddress.name}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id === "followup" && !isPast}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                  : tab.id === "followup" && !isPast
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "brief" && <BriefTab event={event} />}
        {activeTab === "agenda" && <AgendaTab event={event} />}
        {activeTab === "notes" && <NotesTab event={event} />}
        {activeTab === "followup" && <FollowUpTab event={event} />}
      </div>
    </div>
  );
}

// ─── Brief Tab ─────────────────────────────────────────────────────────────
function BriefTab({ event }: { event: CalendarEvent }) {
  const [brief, setBrief] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const generateBrief = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/meeting-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.subject,
          attendees: event.organizer ? [event.organizer.emailAddress.name] : [],
          meetingTime: event.start.dateTime,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBrief(data.brief || []);
    } catch {
      toast.error("Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      {brief.length === 0 ? (
        <div className="text-center py-8">
          <Sparkles className="w-8 h-8 text-violet-300 dark:text-violet-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Generate an AI-powered brief for this meeting</p>
          <button
            onClick={generateBrief}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Brief
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Meeting Brief</h3>
            <button
              onClick={generateBrief}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Regenerate"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
          </div>
          <div className="space-y-2.5">
            {brief.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Agenda Tab ────────────────────────────────────────────────────────────
function AgendaTab({ event }: { event: CalendarEvent }) {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), text: "" }]);
  };

  const updateItem = (id: string, text: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, text } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const suggestAgenda = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/meeting-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: event.subject, attendees: [], meetingTime: event.start.dateTime }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const suggestions = (data.suggestedAgenda || data.brief || []).slice(0, 5);
      if (suggestions.length > 0) {
        setItems(suggestions.map((text: string) => ({ id: crypto.randomUUID(), text })));
      }
    } catch {
      toast.error("Failed to generate agenda");
    } finally {
      setLoading(false);
    }
  };

  const copyAgenda = () => {
    const text = items.filter(i => i.text.trim()).map((item, i) => `${i + 1}. ${item.text}`).join("\n");
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success("Agenda copied!");
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Agenda</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={suggestAgenda}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI suggest
          </button>
          {items.length > 0 && (
            <button
              onClick={copyAgenda}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab" />
            <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(item.id, e.target.value)}
              placeholder="Agenda item..."
              className="flex-1 text-sm bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-violet-500 outline-none py-1 text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add item
      </button>
    </div>
  );
}

// ─── Notes Tab ─────────────────────────────────────────────────────────────
function NotesTab({ event }: { event: CalendarEvent }) {
  const [notes, setNotes] = useState("");
  const [meetingNoteId, setMeetingNoteId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotes = useCallback(async (text: string) => {
    try {
      if (meetingNoteId) {
        await apiFetch(`/api/meeting-notes/${meetingNoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawNotes: text }),
        });
      } else {
        const res = await apiFetch("/api/meeting-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.subject || "Meeting notes",
            rawNotes: text,
            meetingDate: event.start.dateTime,
            source: "calendar",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setMeetingNoteId(data.id);
        }
      }
    } catch { /* auto-save failed silently */ }
  }, [meetingNoteId, event.subject, event.start.dateTime]);

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(text), 2000);
  };

  const insertTag = (tag: string) => {
    const insertion = `[${tag}: ]`;
    setNotes(prev => prev + (prev && !prev.endsWith("\n") ? "\n" : "") + insertion);
  };

  // Highlight [ACTION: ...] and [DECISION: ...] in the display
  const highlightedNotes = notes
    .replace(/\[ACTION:\s*([^\]]*)\]/g, '<span class="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-1 rounded">[ACTION: $1]</span>')
    .replace(/\[DECISION:\s*([^\]]*)\]/g, '<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-1 rounded">[DECISION: $1]</span>');

  return (
    <div className="p-5 space-y-3">
      {/* Mini toolbar */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => insertTag("ACTION")}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <CheckSquare className="w-3 h-3" /> Action item
        </button>
        <button
          onClick={() => insertTag("DECISION")}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <FileText className="w-3 h-3" /> Decision
        </button>
        <span className="text-[10px] text-gray-400 ml-auto">Auto-saves</span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Start taking notes...\n\nUse the toolbar above to tag action items and decisions."
        className="w-full h-[calc(100vh-280px)] min-h-[300px] text-sm leading-relaxed bg-transparent border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
      />
    </div>
  );
}

// ─── Follow-up Tab ─────────────────────────────────────────────────────────
function FollowUpTab({ event }: { event: CalendarEvent }) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTasks, setAddingTasks] = useState(false);

  // TODO: We'd ideally read from the saved meeting note's rawNotes.
  // For now, the user clicks "Extract" to parse any notes.
  const extractFromNotes = async () => {
    setLoading(true);
    try {
      // Try to get existing meeting notes
      const notesRes = await apiFetch("/api/meeting-notes");
      const allNotes = notesRes.ok ? await notesRes.json() : [];
      const relevant = allNotes.find(
        (n: { title: string }) => n.title === event.subject || n.title === "Meeting notes"
      );

      if (!relevant?.rawNotes) {
        toast.info("No notes found. Take notes in the Notes tab first.");
        setLoading(false);
        return;
      }

      const res = await apiFetch("/api/ai/extract-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: relevant.rawNotes }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      setActionItems(
        (data.actionItems || []).map((a: { text: string; assignee: string | null }) => ({
          id: crypto.randomUUID(),
          text: a.text,
          assignee: a.assignee,
          checked: true,
        }))
      );
      setDecisions(
        (data.decisions || []).map((d: { text: string }) => ({
          id: crypto.randomUUID(),
          text: d.text,
        }))
      );
    } catch {
      toast.error("Failed to extract actions");
    } finally {
      setLoading(false);
    }
  };

  const toggleAction = (id: string) => {
    setActionItems(prev => prev.map(a => a.id === id ? { ...a, checked: !a.checked } : a));
  };

  const addAllAsTasks = async () => {
    const checked = actionItems.filter(a => a.checked);
    if (checked.length === 0) {
      toast.info("No action items selected");
      return;
    }
    setAddingTasks(true);
    try {
      for (const item of checked) {
        await apiFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.text,
            priority: 2,
            labels: ["meeting-followup"],
          }),
        });
      }
      toast.success(`${checked.length} task(s) created!`);
    } catch {
      toast.error("Failed to create tasks");
    } finally {
      setAddingTasks(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {actionItems.length === 0 && decisions.length === 0 ? (
        <div className="text-center py-8">
          <ArrowRight className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Extract action items and decisions from your meeting notes</p>
          <button
            onClick={extractFromNotes}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Extract action items
          </button>
        </div>
      ) : (
        <>
          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Action Items ({actionItems.filter(a => a.checked).length}/{actionItems.length})
                </h3>
                <button
                  onClick={addAllAsTasks}
                  disabled={addingTasks}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {addingTasks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add as tasks
                </button>
              </div>
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleAction(item.id)}
                      className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{item.text}</p>
                      {item.assignee && (
                        <p className="text-xs text-gray-400 mt-0.5">Assigned to: {item.assignee}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisions */}
          {decisions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Decisions</h3>
              <div className="space-y-2">
                {decisions.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
