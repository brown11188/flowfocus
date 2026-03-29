"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Calendar, Clock, ChevronRight, FileText, Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MeetingPrepDrawer } from "./meeting-prep-drawer";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer?: { emailAddress: { address: string; name: string } } | null;
  bodyPreview?: string;
  webLink?: string;
  attendees?: Array<{ emailAddress: { address: string; name: string } }>;
}

interface SavedMeetingNote {
  id: string;
  title: string;
  rawNotes: string;
  summary: string | null;
  actionItems: string | null;
  meetingDate: string;
  source: string;
}

export function PMMeetingsTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedMeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [msConnected, setMsConnected] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      tomorrow.setHours(0, 0, 0, 0);

      const res = await apiFetch(
        `/api/microsoft/calendar?startDate=${now.toISOString()}&endDate=${tomorrow.toISOString()}`
      );
      if (res.status === 400) {
        setMsConnected(false);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEvents((data.events || []).sort((a: CalendarEvent, b: CalendarEvent) =>
        new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
      ));
    } catch {
      // Silent — may not have MS connected
      setMsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedNotes = useCallback(async () => {
    try {
      const res = await apiFetch("/api/meeting-notes");
      if (res.ok) setSavedNotes(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void loadEvents();
    void loadSavedNotes();
  }, [loadEvents, loadSavedNotes]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const getDuration = (start: string, end: string) => {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  const now = new Date();
  const todayEvents = events.filter(e => new Date(e.start.dateTime).toDateString() === now.toDateString());
  const tomorrowEvents = events.filter(e => {
    const d = new Date(e.start.dateTime);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  });

  return (
    <>
      <div className="space-y-5">
        {/* Upcoming Meetings */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Upcoming Meetings</span>
            {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>

          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {!msConnected ? (
              <div className="p-6 text-center">
                <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Microsoft 365 not connected</p>
                <Link
                  href="/integrations"
                  className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium transition-colors"
                >
                  Connect Microsoft 365 in Settings →
                </Link>
              </div>
            ) : loading ? (
              <div className="p-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex gap-3 mb-3">
                    <div className="w-16 h-4 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming meetings 🎉</p>
              </div>
            ) : (
              <>
                {todayEvents.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Today</span>
                    </div>
                    {todayEvents.map(event => (
                      <MeetingEventCard key={event.id} event={event} onPrep={() => setSelectedEvent(event)} formatTime={formatTime} getDuration={getDuration} />
                    ))}
                  </div>
                )}
                {tomorrowEvents.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tomorrow</span>
                    </div>
                    {tomorrowEvents.map(event => (
                      <MeetingEventCard key={event.id} event={event} onPrep={() => setSelectedEvent(event)} formatTime={formatTime} getDuration={getDuration} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Past Meeting Notes */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Past Meeting Notes</span>
            <span className="text-xs text-gray-400">{savedNotes.length} note(s)</span>
          </div>

          {savedNotes.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No meeting notes yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {savedNotes.slice(0, 10).map(note => {
                const actionCount = (note.actionItems || "").split("[ACTION:").length - 1;
                return (
                  <div key={note.id} className="px-4 py-3 flex items-start gap-3">
                    <Users className="w-4 h-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{note.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(note.meetingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {actionCount > 0 && ` · ${actionCount} action item(s)`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Meeting Prep Drawer */}
      {selectedEvent && (
        <MeetingPrepDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}

// ─── Meeting Event Card ─────────────────────────────────────────────────
function MeetingEventCard({
  event,
  onPrep,
  formatTime,
  getDuration,
}: {
  event: CalendarEvent;
  onPrep: () => void;
  formatTime: (d: string) => string;
  getDuration: (s: string, e: string) => string;
}) {
  const attendeeCount = event.attendees?.length ?? 0;
  const isPast = new Date(event.end.dateTime) < new Date();
  const isSoon = !isPast && new Date(event.start.dateTime).getTime() - Date.now() < 60 * 60 * 1000;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
      isPast && "opacity-60"
    )}>
      <div className="text-right w-14 flex-shrink-0">
        <p className={cn("text-xs font-medium", isSoon ? "text-violet-600 dark:text-violet-400" : "text-gray-700 dark:text-gray-300")}>
          {formatTime(event.start.dateTime)}
        </p>
        <p className="text-[10px] text-gray-400">{getDuration(event.start.dateTime, event.end.dateTime)}</p>
      </div>
      <div className={cn("w-0.5 h-8 rounded-full flex-shrink-0", isSoon ? "bg-violet-500" : "bg-gray-200 dark:bg-gray-700")} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{event.subject || "(No title)"}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {event.organizer?.emailAddress?.name || ""}
          {attendeeCount > 0 && ` · ${attendeeCount} attendee(s)`}
        </p>
      </div>
      <button
        onClick={onPrep}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
          isSoon
            ? "bg-violet-600 text-white hover:bg-violet-700"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-950 dark:hover:text-violet-400"
        )}
      >
        Prep <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}
